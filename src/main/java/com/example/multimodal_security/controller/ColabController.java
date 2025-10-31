package com.example.multimodal_security.controller;

import com.example.multimodal_security.dto.LoginRequest;
import com.example.multimodal_security.dto.PythonResponse;
import com.example.multimodal_security.service.ExcessToColab;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/colab")
@RequiredArgsConstructor
public class ColabController {
    private final ExcessToColab excessToColab;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PythonResponse getColabResponse(@ModelAttribute LoginRequest loginRequest) {
        System.out.println("요청은 다음과 같습니다 {행동 명령}: "+ loginRequest.getPrompt_action() + " {음성 명령}: " + loginRequest.getPrompt_speech());
        return excessToColab.sendToPython(loginRequest);
    }
}
