"""
verify.py
---------------
Video + Speech 기반 행동/발화 검증 모듈 (수동 전처리 버전)
- VideoMAE: 프레임 샘플링 → 리사이즈/정규화 → 모델 추론
- Whisper: 음성 텍스트 인식 후 유사도 판정
"""

import torch, numpy as np, torchvision.transforms as T
from torchvision.io import read_video
from sentence_transformers import SentenceTransformer, util
from difflib import SequenceMatcher
from PIL import Image

EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
# ============================================================
# 1. 모델 로드
# ============================================================
def load_models():
    """
    VideoMAE (행동), Whisper (음성) 모델 로드 함수
    """
    from transformers import AutoModelForVideoClassification
    import whisper
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # VideoMAE 로드 (Kinetics-400 사전학습)
    model_name = "MCG-NJU/videomae-base-finetuned-kinetics"
    video_model = AutoModelForVideoClassification.from_pretrained(model_name).to(device)

    # Whisper 로드
    whisper_model = whisper.load_model("small", device=device)

    print(f"모델 로드 완료 ({device})")
    return video_model, whisper_model, device


# ============================================================
# 2. Video 행동 검증 (수동 전처리) - VideoMAE 사용
# ============================================================
@torch.no_grad()
def action_verification(
    video_path, prompt_action,
    model, device):
    """
    VideoMAE 행동 검증 (processor 없이 수동 전처리)
    입력:
        video_path (str): 비디오 파일 경로
        prompt_action (str): 행동 프롬프트
        model: VideoMAE 모델
        device: cuda 또는 cpu
    출력:
        (bool, float)
    """
    # (0) 고정 값
    num_frames= 16
    threshold = 0.55
    top_k = 5

    # (1) 비디오 로드
    import os
    video_path = os.path.abspath(video_path)
    video, _, _ = read_video(video_path, pts_unit="sec")
    if video.ndim != 4 or video.shape[-1] != 3:
        raise ValueError(f"비디오 형식 오류: shape={video.shape}")

    # (2) 프레임 보정
    total_frames = video.shape[0]
    if total_frames < num_frames:
        repeat_factor = int(np.ceil(num_frames / total_frames))
        video = video.repeat(repeat_factor, 1, 1, 1)
        total_frames = video.shape[0]

    # (3) 균등 샘플링
    idx = torch.linspace(0, total_frames - 1, num_frames).long()
    sampled_frames = video[idx]  # (T, H, W, C)

    # (4) 수동 전처리 (224x224 + normalize)
    transform = T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])

    processed_frames = [transform(Image.fromarray(frame.numpy())) for frame in sampled_frames]
    pixel_values = torch.stack(processed_frames)  # (T, 3, 224, 224)
    pixel_values = pixel_values.permute(1, 0, 2, 3).unsqueeze(0).to(device)  # ✅ (1, 3, 16, 224, 224)
    pixel_values = pixel_values.permute(0, 2, 1, 3, 4).contiguous()  # (B, T, C, H, W)

    # (5) 모델 추론
    outputs = model(pixel_values=pixel_values)
    probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy().flatten()

    # (6) Top-K 추출
    top_indices = np.argsort(probs)[::-1][:top_k]
    top_labels = [model.config.id2label[i] for i in top_indices]
    top_probs = [float(probs[i]) for i in top_indices]

    # (7) 의미 유사도 계산
    prompt_emb = EMBEDDER.encode(prompt_action, convert_to_tensor=True)
    sims = [
        util.cos_sim(prompt_emb, EMBEDDER.encode(lbl, convert_to_tensor=True)).item()
        for lbl in top_labels
    ]

    # (8) 결과 계산
    sim_best = float(np.max(sims))
    result = round(sim_best,3) >= threshold

    print(f"\n[Prompt] {prompt_action}")
    print(f"[Max Similarity] {sim_best:.3f} | Result: {result}")
    return result, round(sim_best, 3)


# ============================================================
# 3. Speech 발화 검증 (Whisper)
# ============================================================
def speech_verification(
    audio_path, target_text, whisper_model
):
    """
    Whisper 기반 발화 검증
    """
    tolerance = 0.889

    result = whisper_model.transcribe(audio_path, language="ko")
    predicted = result["text"].strip()

    sim = SequenceMatcher(None, predicted.lower(), target_text.lower()).ratio()
    is_match = round(sim, 3) >= tolerance

    print("\n[Speech Verification]")
    print(f"Predicted: {predicted}")
    print(f"Target:    {target_text}")
    print(f"Similarity: {sim:.3f} | Result: {is_match}")

    return is_match, round(sim, 3)