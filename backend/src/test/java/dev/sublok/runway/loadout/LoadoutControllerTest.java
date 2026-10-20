package dev.sublok.runway.loadout;

import static dev.sublok.runway.user.TestUsers.signedIn;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.sublok.runway.config.SecurityConfig;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutResponse;
import dev.sublok.runway.user.RunwayOidcUserService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** HTTP contract only: status codes, headers, validation and error shapes. The service is mocked. */
@WebMvcTest(LoadoutController.class)
@Import(SecurityConfig.class)
class LoadoutControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    LoadoutService service;

    @MockitoBean
    RunwayOidcUserService oidcUserService;

    final UUID user = UUID.randomUUID();

    @Test
    void createReturns201WithLocation() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.create(eq(user), any())).thenReturn(response(id));

        mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm")))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith("/api/loadouts/" + id)))
                .andExpect(jsonPath("$.id").value(id.toString()));
    }

    @Test
    void invalidColorIsA400ProblemNamingTheField() throws Exception {
        mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm", "not-a-color")))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[*].field", hasItem("colorState.primary.hex")));
        verifyNoInteractions(service);
    }

    @Test
    void blankNameIsRejected() throws Exception {
        mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", " ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("name")));
    }

    @Test
    void unknownIdIsA404Problem() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(user, id)).thenThrow(new LoadoutNotFoundException(id));

        mvc.perform(get("/api/loadouts/{id}", id).with(signedIn(user)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Loadout not found"));
    }

    @Test
    void capIsA409Problem() throws Exception {
        when(service.create(eq(user), any())).thenThrow(new LoadoutLimitExceededException("Volt", 6));

        mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Seventh")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Loadout limit reached"));
    }

    @Test
    void malformedIdIsA400() throws Exception {
        mvc.perform(get("/api/loadouts/not-a-uuid").with(signedIn(user))).andExpect(status().isBadRequest());
    }

    @Test
    void deleteReturns204() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(delete("/api/loadouts/{id}", id).with(signedIn(user)).with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deletingAMissingLoadoutIsA404() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new LoadoutNotFoundException(id)).when(service).delete(user, id);
        mvc.perform(delete("/api/loadouts/{id}", id).with(signedIn(user)).with(csrf()))
                .andExpect(status().isNotFound());
    }

    private static LoadoutResponse response(UUID id) {
        var req = LoadoutFixtures.request("Volt", "Storm");
        return new LoadoutResponse(
                id,
                req.frame(),
                req.name(),
                req.creator(),
                false,
                req.attachments(),
                req.colorState(),
                Instant.now(),
                Instant.now());
    }

    @Test
    void withoutASessionTheApiAnswers401NotARedirect() throws Exception {
        mvc.perform(get("/api/loadouts")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void writesWithoutACsrfTokenAreRejected() throws Exception {
        mvc.perform(post("/api/loadouts")
                        .with(signedIn(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
}
