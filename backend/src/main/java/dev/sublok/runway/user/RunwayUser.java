package dev.sublok.runway.user;

import java.util.UUID;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * The signed-in principal: Google's OIDC user plus our own account id, resolved once at sign-in
 * and kept in the session so requests don't need a user lookup.
 */
public class RunwayUser extends DefaultOidcUser {

    private final UUID userId;

    public RunwayUser(UUID userId, OidcUser google) {
        super(google.getAuthorities(), google.getIdToken(), google.getUserInfo());
        this.userId = userId;
    }

    public UUID userId() {
        return userId;
    }
}
