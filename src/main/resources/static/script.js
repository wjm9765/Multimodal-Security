// javascript
// 변경: 모든 fetch URL을 localhost:8080으로 고정하고, 화면 표시에는 "라고 말하기"를 추가하되 변수는 원본 유지.

// DOM 요소 가져오기
const loginButton = document.getElementById('loginButton');
const completeButton = document.getElementById('completeButton');
const preview = document.getElementById('preview');
const recordedVideo = document.getElementById('recordedVideo');
const downloadLink = document.getElementById('downloadLink');
const resultContainer = document.getElementById('resultContainer');

const promptButton = document.getElementById('promptButton');
const promptDisplay = document.getElementById('promptDisplay');

// 상태 변수
let stream = null;
let mediaRecorder = null;
let recordedChunks = [];
let savedPrompt = null; // 서버에 보낼 결합 프롬프트(사용하지 않아도 됨)
let prompt_action = null; // action 프롬프트
let prompt_speech = null;  // saying 프롬프트

// 상태 변수 추가
let _recordingStartTime = null;
let _recordingTimerId = null;
let _prevPromptText = null;

// ------------------------ 프롬프트 버튼 로직 ------------------------
promptButton.addEventListener('click', async () => {
    try {
        // 포트 8080 고정
        const [resAction, resSaying] = await Promise.all([
            fetch('http://localhost:8080/api/gpt/actions'),
            fetch('http://localhost:8080/api/gpt/saying')
        ]);

        // 상태 체크
        if (!resAction.ok || !resSaying.ok) {
            console.error('프롬프트 응답 오류', resAction.status, resSaying.status);
            promptDisplay.textContent = '프롬프트 조회 실패';
            prompt_action = null;
            prompt_speech = null;
            savedPrompt = null;
            return;
        }

        // JSON 파싱
        const actionJson = await resAction.json().catch(() => null);
        const sayingJson = await resSaying.json().catch(() => null);

        // 응답 구조에서 정확한 키를 추출. 예: { "prompt_action": "tossing coin(동전을 던지세요)." }
        const actionVal = actionJson && (actionJson.prompt_action ?? actionJson.prompt ?? actionJson.data ?? null);
        const sayingVal = sayingJson && (sayingJson.prompt_speech ?? sayingJson.prompt ?? sayingJson.data ?? null);

        // 변수에는 원본(예: "{사과}") 형식을 그대로 저장
        prompt_action = (actionVal || '동작 프롬프트 없음').toString().trim();
        prompt_speech = (sayingVal || '말하기 프롬프트 없음').toString().trim();

        // 화면에는 '라고 말하기' 추가하여 표시 (변수 자체는 변경하지 않음)
        const displayText = `${prompt_action}, ${prompt_speech}라고 말하기`;
        promptDisplay.textContent = displayText;

        // 서버 전송용 savedPrompt는 원본 콤비네이션 유지
        savedPrompt = `${prompt_action}, ${prompt_speech}`;

    } catch (err) {
        console.error('프롬프트 조회 실패', err);
        promptDisplay.textContent = '프롬프트 조회 실패';
        savedPrompt = null;
        prompt_action = null;
        prompt_speech = null;
    }
});

// ------------------------ 녹화 인디케이터 로직 ------------------------
function _startRecordingIndicator() {
    _recordingStartTime = Date.now();
    _prevPromptText = promptDisplay.textContent;
    promptDisplay.textContent = `● 녹화중 — ${_prevPromptText}`;

    _recordingTimerId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - _recordingStartTime) / 1000);
        promptDisplay.textContent = `● 녹화중 (${elapsed}s) — ${_prevPromptText}`;
    }, 1000);
}

function _stopRecordingIndicator() {
    if (_recordingTimerId) {
        clearInterval(_recordingTimerId);
        _recordingTimerId = null;
    }
    _recordingStartTime = null;
    // 복원: 저장된 프롬프트가 있으면 그것으로, 아니면 이전 텍스트
    if (savedPrompt) {
        promptDisplay.textContent = `${savedPrompt}라고 말하기`;
    } else if (_prevPromptText) {
        promptDisplay.textContent = _prevPromptText;
    }
    _prevPromptText = null;
}

// ------------------------ 녹화 로직 ------------------------
async function startRecording() {
    // 브라우저 지원 체크
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('이 브라우저는 카메라/마이크 접근을 지원하지 않습니다. 최신 브라우저를 사용하세요.');
        return;
    }

    // 이미 녹화 중이면 무시
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.warn('이미 녹화 중입니다.');
        return;
    }

    try {
        // 디바이스 목록 로그 (디버깅 도움)
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                console.log('사용 가능한 미디어 디바이스:', devices);
            } catch (e) {
                console.debug('enumerateDevices 실패:', e);
            }
        }

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    } catch (err) {
        console.error('getUserMedia 실패:', err);
        alert('카메라 또는 마이크 권한이 필요합니다. 권한을 확인하세요. (콘솔을 확인해 자세한 에러 확인)');
        return;
    }

    // 미리보기에 스트림 연결
    try {
        preview.srcObject = stream;
        preview.muted = true; // 피드백 방지
        await preview.play();
    } catch (e) {
        console.warn('preview 재생 실패(자동재생 정책 등):', e);
    }

    // 트랙 로그
    try {
        console.log('스트림 트랙:', stream.getTracks().map(t => ({ kind: t.kind, id: t.id, label: t.label })));
    } catch (e) {
        console.debug('스트림 트랙 정보 조회 실패:', e);
    }

    recordedChunks = [];

    // 코덱/형식 우선순위
    let options = {};
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options = { mimeType: 'video/webm;codecs=vp9' };
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (err) {
        console.error('MediaRecorder 생성 실패:', err);
        alert('이 브라우저에서 MediaRecorder를 지원하지 않거나 지정된 코덱을 사용할 수 없습니다. (콘솔 확인)');
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        return;
    }

    mediaRecorder.onstart = () => {
        console.log('녹화 시작');
        loginButton.disabled = true;
        completeButton.disabled = false;
        promptDisplay.dataset.recording = 'true';
        _startRecordingIndicator();
    };

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
            console.log('chunk 수집, 총:', recordedChunks.length, '크기(kB):', Math.round(event.data.size/1024));
        }
    };

    mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        alert('녹화 중 오류가 발생했습니다. 콘솔 로그를 확인하세요.');
    };

    mediaRecorder.onstop = async () => {
        console.log('녹화 중지 이벤트 발생, chunk 수:', recordedChunks.length);

        // 일부 브라우저에서 마지막 ondataavailable이 비동기적으로 들어올 수 있으므로
        // 매우 짧게 대기하여 최종 청크가 recordedChunks에 추가되도록 보장합니다.
        await new Promise(resolve => setTimeout(resolve, 250));

        // 안전하게 스트림을 중지
        try {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        } catch (e) {
            console.warn('스트림 정리 중 오류:', e);
        }

        // Blob 생성
        if (!recordedChunks || recordedChunks.length === 0) {
            alert('녹화된 데이터가 없습니다. 다시 시도해주세요.');
            preview.srcObject = null;
            mediaRecorder = null;
            stream = null;
            loginButton.disabled = false;
            completeButton.disabled = true;
            promptDisplay.dataset.recording = 'false';
            _stopRecordingIndicator();
            return;
        }

        const mimeType = recordedChunks[0].type || 'video/webm';
        const videoBlob = new Blob(recordedChunks, { type: mimeType });
        const videoUrl = URL.createObjectURL(videoBlob);

        // 미리보기(녹화된 비디오) 및 다운로드 링크 세팅
        recordedVideo.src = videoUrl;
        recordedVideo.controls = true;
        const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        downloadLink.href = videoUrl;
        downloadLink.download = filename;
        downloadLink.style.display = 'inline-block';
        resultContainer.style.display = 'block';

        // 정리
        preview.srcObject = null;
        mediaRecorder = null;
        stream = null;
        promptDisplay.dataset.recording = 'false';
        _stopRecordingIndicator();

        // 서버로 업로드
        try {
            await uploadVideoAndPrompt(videoBlob, filename);
        } catch (e) {
            console.error('업로드 중 오류:', e);
            alert('서버 업로드 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        } finally {
            loginButton.disabled = false;
            completeButton.disabled = true;
        }
    };

    // 오디오 트랙 유무 확인
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
        console.warn('오디오 트랙이 없습니다. 마이크 권한이 거부되었거나 장치 없음.');
        alert('마이크를 사용할 수 없습니다. 오디오 없이 비디오만 녹화됩니다.');
    }

    try {
        // timeslice를 제거하여 브라우저가 onstop 시 단일 완전한 Blob을 제공하도록 시도
        // 일부 환경에서는 timeslice가 많은 작은 청크를 생성해 컨테이너가 완전히 마무리되지 않은 상태로 전송될 수 있으므로
        // 기본 동작으로 시작합니다.
        mediaRecorder.start();
        console.log('mediaRecorder.state after start:', mediaRecorder.state);
    } catch (e) {
        console.error('mediaRecorder.start 실패:', e);
        alert('녹화를 시작할 수 없습니다. 콘솔 확인');
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        mediaRecorder = null;
        return;
    }
}

function stopRecording() {
    if (!mediaRecorder) {
        console.warn('mediaRecorder가 없습니다.');
        return;
    }
    if (mediaRecorder.state === 'recording') {
        try {
            // 남아있는 데이터가 있으면 즉시 플러시 요청
            try { mediaRecorder.requestData(); } catch (reqErr) { console.debug('requestData 실패 or 미지원:', reqErr); }
            mediaRecorder.stop();
            console.log('mediaRecorder.stop 호출됨');
        } catch (e) {
            console.error('mediaRecorder.stop 실패:', e);
        }
    } else {
        console.log('mediaRecorder 상태:', mediaRecorder.state);
    }
    // 버튼 상태는 onstart/onstop에서 처리하지만 예비로 설정
    loginButton.disabled = false;
    completeButton.disabled = true;
}

// 버튼 이벤트 연결 (이미 연결돼 있을 수 있지만 안전하게 재연결)
try {
    loginButton.removeEventListener('click', startRecording);
    completeButton.removeEventListener('click', stopRecording);
} catch (e) {
    // 무시
}
loginButton.addEventListener('click', startRecording);
completeButton.addEventListener('click', stopRecording);

// ------------------------ 업로드 함수 ------------------------
async function uploadVideoAndPrompt(videoBlob, filename) {
    const verifyUrl = 'https://streaky-uncrushable-bennett.ngrok-free.dev/api/verify';
    const colabUrl = 'http://localhost:8080/api/colab';

    // FormData 생성 함수 (매 요청마다 새로 생성)
    const makeForm = () => {
        const form = new FormData();
        const file = new File([videoBlob], filename, { type: videoBlob.type || 'video/webm' });
        form.append('videoFile', file);
        form.append('prompt_action', prompt_action ?? '');
        form.append('prompt_speech', prompt_speech ?? '');
        return form;
    };

    // 응답에서 success/message를 안전하게 추출하는 헬퍼
    const parseResponse = async (res) => {
        let success = false;
        let message = '';

        // 시도: JSON 파싱
        try {
            const json = await res.json();
            if (json && typeof json === 'object') {
                if (typeof json.success === 'boolean') success = json.success;
                if (typeof json.message === 'string') message = json.message;
                if (!message) {
                    if (typeof json.msg === 'string') message = json.msg;
                    else if (typeof json.error === 'string') message = json.error;
                }
            } else if (typeof json === 'boolean') {
                success = json;
            } else if (typeof json === 'string') {
                success = json.trim().toLowerCase() === 'true';
                message = json;
            }
            return { success, message };
        } catch (err) {
            // JSON 파싱 실패하면 텍스트로
            try {
                const txt = await res.text();
                message = txt;
                success = txt && txt.trim().toLowerCase() === 'true';
            } catch (err2) {
                console.warn('응답 파싱 실패', err2);
            }
            return { success, message };
        }
    };

    try {
        // 1) 먼저 verify 엔드포인트로 전송
        const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            body: makeForm()
        });

        const verifyParsed = await parseResponse(verifyRes);
        console.log('verify 응답:', verifyParsed);

        if (!verifyParsed.success) {
            // 인증 실패: 메시지 보여주고 중단
            const msg = verifyParsed.message || '인증 실패';
            alert('로그인 실패: ' + msg);
            return;
        }

        // 2) verify 통과 시 기존 Colab 엔드포인트로 동일한 형식의 요청 전송
        const colabRes = await fetch(colabUrl, {
            method: 'POST',
            body: makeForm()
        });

        const colabParsed = await parseResponse(colabRes);
        console.log('colab 응답:', colabParsed);

        // 기존과 동일한 alert 처리 로직
        if (colabParsed.message) {
            if (colabParsed.success) {
                console.log('서버 응답: 로그인 성공 -', colabParsed.message);
                alert('로그인 성공: ' + colabParsed.message);
            } else {
                console.log('서버 응답: 로그인 실패 -', colabParsed.message);
                alert('로그인 실패: ' + colabParsed.message);
            }
        } else {
            if (colabParsed.success) {
                console.log('서버 응답: 로그인 성공 (메시지 없음)');
                alert('로그인 성공');
            } else {
                console.log('서버 응답: 로그인 실패 (메시지 없음)');
                alert('로그인 실패');
            }
        }
    } catch (err) {
        console.error('업로드 또는 검증 중 오류', err);
        alert('서버 전송 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
}

// 파일 끝
