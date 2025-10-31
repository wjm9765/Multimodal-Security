// java
package com.example.multimodal_security.controller;

import com.example.multimodal_security.service.GptApiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/gpt")
public class GptChatController {

    private final GptApiService gptApiService;

    public GptChatController(GptApiService gptApiService) {
        this.gptApiService = gptApiService;
    }

    /**
     * [GET] 행동 프롬프트를 JSON으로 반환
     * 응답 예: { "prompt_action": "finger snapping" }
     */
    @GetMapping(path = "/actions", produces = "application/json; charset=UTF-8")
    public ResponseEntity<Map<String, String>> getChatResponse() {
        String prompt = "얼굴하고 목소리를 가지고 로그인을 하기 위한 랜덤의 행동 지시문을 줘. 다음 목록 중에서 한 개를 선택해서 랜덤으로 줘."
                + "57 : clapping, 100 : drinking, 119 : exercising arm, 127 : finger snapping"
                + "149 : headbanging, 180 : laughing, 196 : massaging person's head, 264 : reading book,"
                + "288 : shaking hands, 289 : shaking head, 330 : squat, 331 : sticking tongue out, 333 : stretching arm,"
                + " 392 : whistling, 396 : writing, 397 : yawning"
                + "예시) shaking hands. 지시문 이외에 불필요한 대답은 하지 마";

        String responseText = gptApiService.getResponseFromGpt(prompt);
        System.out.println("행동 지시문:" + responseText);

        return ResponseEntity.ok(Map.of("prompt_action", responseText));
    }

    /**
     * [GET] 발화 프롬프트를 JSON으로 반환
     * 응답 예: { "prompt_speech": "{사과}" }
     */
    @GetMapping(path = "/saying", produces = "application/json; charset=UTF-8")
    public ResponseEntity<Map<String, String>> getSayPrompt() {
        String prompt = "얼굴하고 목소리를 가지고 로그인을 하기 위한 랜덤의 발화문 지시문을 줘. 3~5초 정도 길이의 문장이어야돼 예를 들어, {맛있는 사과},{멋있는 사나이}, {즐거운 대학교}, 지시문은 얼굴하고 목소리만 가지고 수행할 수 있어야 하며"
                + "정해진 규칙 없이 랜덤성을 떠야 해, 딱 하나만 지시문으로 줘봐. 불필요한 대답은 하지 마";

        String responseText = gptApiService.getResponseFromGpt(prompt);
        System.out.println("발화 지시문:" + responseText);

        return ResponseEntity.ok(Map.of("prompt_speech", responseText));
    }
}
