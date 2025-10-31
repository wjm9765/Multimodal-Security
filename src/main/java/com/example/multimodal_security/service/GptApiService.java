package com.example.multimodal_security.service;
import com.example.multimodal_security.dto.GptChatResponse;
import com.example.multimodal_security.dto.GptRequest;
import com.example.multimodal_security.dto.message;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

@Service
public class GptApiService {

    private final WebClient webClient;
    private final String gptModel = "gpt-4o-mini"; // 사용할 모델 지정

    public GptApiService(
            WebClient.Builder webClientBuilder,
            @Value("${openai.api.key}") String apiKey, // application.properties에서 주입
            @Value("${openai.api.url}") String apiUrl // application.properties에서 주입
    ) {
        // WebClient 인스턴스 생성 및 공통 헤더 설정 (API Key 및 Content Type)
        this.webClient = webClientBuilder
                .baseUrl(apiUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
    }

    /**
     * 사용자 입력(프롬프트)에 대한 GPT의 응답 텍스트를 반환합니다.
     */
    public String getResponseFromGpt(String userPrompt) {

        // 1. 사용자 메시지를 담은 Message 객체 생성
        message userMessage = new message("user", userPrompt);

        // 2. 요청 본문 DTO 생성 (모델명과 메시지 리스트)
        GptRequest requestBody = new GptRequest(gptModel, List.of(userMessage));

        try {
            // 3. WebClient를 통해 POST 요청 전송 및 응답 수신
            GptChatResponse response = webClient.post()
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(GptChatResponse.class) // 응답 DTO로 매핑
                    .block();

            // 4. 응답 DTO에서 실제 GPT가 생성한 텍스트 추출
            if (response != null && response.getChoices() != null && !response.getChoices().isEmpty()) {
                // 첫 번째 Choice의 메시지 Content를 반환
                return response.getChoices().get(0).getMessage().getContent();
            } else {
                // 응답이 비어있거나 올바르지 않은 경우
                return "Error: GPT 응답을 받지 못했습니다.";
            }

        } catch (Exception e) {
            e.printStackTrace();
            return "API 호출 중 치명적인 오류가 발생했습니다: " + e.getMessage();
        }
    }
}
