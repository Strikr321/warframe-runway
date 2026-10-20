package dev.sublok.runway.user;

import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in account. Unauthenticated calls get 401 from the security config. */
@RestController
public class MeController {

    public record MeResponse(UUID id, String email, String name, String avatarUrl) {}

    private final UserService users;

    public MeController(UserService users) {
        this.users = users;
    }

    @GetMapping("/api/me")
    public MeResponse me(@AuthenticationPrincipal RunwayUser principal) {
        AppUser user = users.find(principal.userId()).orElseThrow();
        return new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getAvatarUrl());
    }
}
