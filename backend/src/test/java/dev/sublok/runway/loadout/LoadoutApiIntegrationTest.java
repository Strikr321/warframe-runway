package dev.sublok.runway.loadout;

import static dev.sublok.runway.user.TestUsers.signedIn;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import dev.sublok.runway.TestcontainersConfiguration;
import dev.sublok.runway.user.AppUserRepository;
import dev.sublok.runway.user.UserService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** The whole stack: HTTP → security → controller → service → JPA → Flyway schema on PostgreSQL. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class LoadoutApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LoadoutRepository loadouts;

    @Autowired
    AppUserRepository users;

    @Autowired
    UserService userService;

    UUID alice;
    UUID bob;

    @BeforeEach
    void setUp() {
        loadouts.deleteAll();
        users.deleteAll();
        alice = userService
                .recordLogin("google-alice", "alice@example.com", "Alice", null)
                .getId();
        bob = userService
                .recordLogin("google-bob", "bob@example.com", "Bob", null)
                .getId();
    }

    private String create(UUID user, String frame, String name) throws Exception {
        String body = mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json(frame, name)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void fullLifecycle() throws Exception {
        String id = create(alice, "Volt", "Storm");

        mvc.perform(get("/api/loadouts/{id}", id).with(signedIn(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.colorState.en2.hex").value("#c8a030"))
                .andExpect(jsonPath("$.attachments.syandana").value("Volca"));

        mvc.perform(put("/api/loadouts/{id}", id)
                        .with(signedIn(alice))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm II", "#112233")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Storm II"))
                .andExpect(jsonPath("$.colorState.primary.hex").value("#112233"));

        mvc.perform(put("/api/loadouts/{id}/favorite", id)
                        .with(signedIn(alice))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"favorite\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(true));

        mvc.perform(get("/api/loadouts").param("frame", "Volt").with(signedIn(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        mvc.perform(delete("/api/loadouts/{id}", id).with(signedIn(alice)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/loadouts/{id}", id).with(signedIn(alice))).andExpect(status().isNotFound());
    }

    @Test
    void usersCannotSeeOrChangeEachOthersLoadouts() throws Exception {
        String alices = create(alice, "Volt", "Alice's");

        mvc.perform(get("/api/loadouts").with(signedIn(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/loadouts/{id}", alices).with(signedIn(bob))).andExpect(status().isNotFound());
        mvc.perform(put("/api/loadouts/{id}", alices)
                        .with(signedIn(bob))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Hijacked")))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/loadouts/{id}", alices).with(signedIn(bob)).with(csrf()))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/loadouts/{id}", alices).with(signedIn(alice)))
                .andExpect(jsonPath("$.name").value("Alice's"));
    }

    @Test
    void theCapIsPerUser() throws Exception {
        for (int i = 0; i < LoadoutService.MAX_LOADOUTS_PER_FRAME; i++) create(alice, "Mesa", "Look " + i);

        mvc.perform(post("/api/loadouts")
                        .with(signedIn(alice))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Mesa", "One too many")))
                .andExpect(status().isConflict());
        create(bob, "Mesa", "Bob's first Mesa");
    }

    @Test
    void anonymousRequestsGet401() throws Exception {
        mvc.perform(get("/api/loadouts")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void writesWithoutCsrfTokenAreForbidden() throws Exception {
        mvc.perform(post("/api/loadouts")
                        .with(signedIn(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "No token")))
                .andExpect(status().isForbidden());
    }

    @Test
    void meReturnsTheSignedInAccount() throws Exception {
        mvc.perform(get("/api/me").with(signedIn(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.name").value("Alice"));
    }

    @Test
    void logoutEndsTheSessionWith204() throws Exception {
        mvc.perform(post("/api/logout").with(signedIn(alice)).with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    void allowsTheAngularDevOriginViaCors() throws Exception {
        mvc.perform(options("/api/loadouts")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
    }

    @Test
    void healthEndpointIsPublic() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
