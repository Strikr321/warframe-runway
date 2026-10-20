package dev.sublok.runway.user;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Signed-in principals for MockMvc, without going through Google. */
public final class TestUsers {

    private TestUsers() {}

    public static RunwayUser principal(UUID userId, String googleSubject) {
        Instant now = Instant.now();
        var idToken = new OidcIdToken(
                "test-id-token",
                now,
                now.plusSeconds(300),
                Map.of("sub", googleSubject, "email", googleSubject + "@example.com"));
        var google = new DefaultOidcUser(AuthorityUtils.createAuthorityList("OIDC_USER"), idToken);
        return new RunwayUser(userId, google);
    }

    /** A request made by {@code userId}'s session. */
    public static RequestPostProcessor signedIn(UUID userId) {
        return SecurityMockMvcRequestPostProcessors.oidcLogin().oidcUser(principal(userId, "sub-" + userId));
    }
}
