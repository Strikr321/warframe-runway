package dev.sublok.runway.user;

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

/** After Google confirms who the user is, records the sign-in and attaches our account id. */
@Component
public class RunwayOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final OidcUserService google = new OidcUserService();
    private final UserService users;

    public RunwayOidcUserService(UserService users) {
        this.users = users;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest request) {
        OidcUser googleUser = google.loadUser(request);
        String name = googleUser.getFullName() != null ? googleUser.getFullName() : googleUser.getEmail();
        AppUser user = users.recordLogin(googleUser.getSubject(), googleUser.getEmail(), name, googleUser.getPicture());
        return new RunwayUser(user.getId(), googleUser);
    }
}
