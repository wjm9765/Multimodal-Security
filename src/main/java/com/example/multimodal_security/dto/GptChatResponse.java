package com.example.multimodal_security.dto;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Setter;

import java.util.List;

// GPT API로부터 받을 전체 응답 본문
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class GptChatResponse {
    private List<Choice> choices;
    // id, object, created 등 다른 메타데이터는 생략 가능

    // 응답 안의 choices 배열 요소
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Choice {
        private Message message;

        @Getter
        @Setter
        public static class Message {
            private String role;
            private String content;
        }
    }

    // 응답 안의 usage 객체 (토큰 정보)
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Usage {
        private int prompt_tokens;
        private int completion_tokens;
        private int total_tokens;

    }
}