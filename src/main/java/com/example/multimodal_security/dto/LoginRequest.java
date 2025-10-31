package com.example.multimodal_security.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class LoginRequest {
    private MultipartFile videoFile;  // 프론트엔드에서 보낸 영상 파일
    private String prompt_action;
    private String prompt_speech;
}

