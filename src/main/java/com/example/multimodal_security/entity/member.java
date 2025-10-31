package com.example.multimodal_security.entity;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class member {
    private Long id;                    // 회원 고유 ID
    private String name;                // 사람 이름
    private float[] faceEmbedding;      // 얼굴 임베딩 값 (벡터 배열)
    private float[] voiceEmbedding;     // 목소리 임베딩 값 (벡터 배열)
}
