package dev.sublok.runway.loadout;

import static org.hamcrest.Matchers.hasSize;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** The whole stack: HTTP → controller → service → JPA → Flyway schema on PostgreSQL. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class LoadoutApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    LoadoutRepository repository;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void fullLifecycle() throws Exception {
        String body = mvc.perform(post("/api/loadouts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.favorite").value(false))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(body, "$.id");

        mvc.perform(get("/api/loadouts/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.colorState.en2.hex").value("#c8a030"))
                .andExpect(jsonPath("$.attachments.syandana").value("Volca"));

        mvc.perform(put("/api/loadouts/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Volt", "Storm II", "#112233")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Storm II"))
                .andExpect(jsonPath("$.colorState.primary.hex").value("#112233"));

        mvc.perform(put("/api/loadouts/{id}/favorite", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"favorite\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(true));

        mvc.perform(get("/api/loadouts").param("frame", "Volt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        mvc.perform(delete("/api/loadouts/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/loadouts/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void enforcesTheSixPerFrameCap() throws Exception {
        for (int i = 0; i < LoadoutService.MAX_LOADOUTS_PER_FRAME; i++) {
            mvc.perform(post("/api/loadouts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(LoadoutFixtures.json("Mesa", "Look " + i)))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/loadouts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LoadoutFixtures.json("Mesa", "One too many")))
                .andExpect(status().isConflict());
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
    void healthEndpointIsUp() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
