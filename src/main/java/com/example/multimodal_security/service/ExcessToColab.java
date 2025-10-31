package com.example.multimodal_security.service;

import com.example.multimodal_security.dto.LoginRequest;
import com.example.multimodal_security.dto.PythonResponse;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class ExcessToColab {
    private final WebClient webClient;

    public ExcessToColab(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("https://truman-sylphlike-marco.ngrok-free.dev").build();
    }

    // 변경: boolean -> PythonResponse
    public PythonResponse sendToPython(LoginRequest request) {
        try {
            MultiValueMap<String, Object> multipartData = new LinkedMultiValueMap<>();

            MultipartFile file = request.getVideoFile();
            if (file != null && !file.isEmpty()) {
                ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
                    @Override
                    public String getFilename() {
                        return file.getOriginalFilename();
                    }
                };
                multipartData.add("videoFile", resource);
            }

            multipartData.add("prompt_action", request.getPrompt_action() == null ? "" : request.getPrompt_action());
            multipartData.add("prompt_speech", request.getPrompt_speech() == null ? "" : request.getPrompt_speech());

            PythonResponse pythonResponse = webClient.post()
                    .uri("/api/ai")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(multipartData))
                    .retrieve()
                    .bodyToMono(PythonResponse.class)
                    .block();

            System.out.println("결과는 다음과 같습니다" + pythonResponse);

            if (pythonResponse == null) {
                return new PythonResponse(false, "파이썬 응답이 비어있습니다");
            }
            return pythonResponse;
        } catch (Exception e) {
            e.printStackTrace();
            return new PythonResponse(false, e.getMessage());
        }
    }
}
