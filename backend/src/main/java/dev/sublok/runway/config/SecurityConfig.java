package dev.sublok.runway.config;

import static org.springframework.security.config.Customizer.withDefaults;

import dev.sublok.runway.user.RunwayOidcUserService;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * Backend-for-frontend sign-in: Spring runs the Google OAuth2 / OIDC flow and keeps the result in
 * a server-side session. The browser only holds an HttpOnly session cookie, never a token.
 *
 * <ul>
 *   <li>{@code /api/**} requires a session; without one it answers 401 (no redirect), so the web
 *       app can show its own sign-in screen.
 *   <li>CSRF uses the SPA setup: the token is in an {@code XSRF-TOKEN} cookie that Angular's
 *       HttpClient echoes back as the {@code X-XSRF-TOKEN} header.
 *   <li>Sign-out is {@code POST /api/logout} → 204.
 * </ul>
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            RunwayOidcUserService oidcUserService,
            @Value("${runway.frontend-url}") String frontendUrl)
            throws Exception {
        var api = PathPatternRequestMatcher.withDefaults().matcher("/api/**");
        http.authorizeHttpRequests(auth -> auth.requestMatchers("/actuator/health/**", "/actuator/info", "/error")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .oauth2Login(login -> login.userInfoEndpoint(info -> info.oidcUserService(oidcUserService))
                        .defaultSuccessUrl(frontendUrl, true)
                        .failureUrl(frontendUrl + "/?signin=failed"))
                .exceptionHandling(errors -> errors.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED), api))
                .logout(logout -> logout.logoutRequestMatcher(
                                PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/logout"))
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .csrf(csrf -> csrf.spa())
                .cors(withDefaults());
        return http.build();
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
