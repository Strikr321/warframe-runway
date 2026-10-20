package dev.sublok.runway.loadout;

import static org.assertj.core.api.Assertions.assertThat;

import dev.sublok.runway.TestcontainersConfiguration;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

/** Runs against real PostgreSQL with the Flyway schema, so mappings and constraints are exercised. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfiguration.class)
class LoadoutRepositoryTest {

    @Autowired
    LoadoutRepository repository;

    @Autowired
    EntityManager em;

    @Test
    void persistsAttachmentsAndAllEightColorChannels() {
        Loadout saved = repository.saveAndFlush(newLoadout("Volt", "Storm"));
        em.clear();

        Loadout found = repository.findWithColorsById(saved.getId()).orElseThrow();
        assertThat(found.getColors()).hasSize(8).containsKey(ColorChannel.ENERGY_2);
        assertThat(found.getAttachments().getSyandana()).isEqualTo("Volca");
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getVersion()).isZero();
    }

    @Test
    void countsAndFiltersByFrame() {
        repository.saveAndFlush(newLoadout("Volt", "One"));
        repository.saveAndFlush(newLoadout("Volt", "Two"));
        repository.saveAndFlush(newLoadout("Mesa", "Three"));

        assertThat(repository.countByFrame("Volt")).isEqualTo(2);
        assertThat(repository.findByFrameOrderByUpdatedAtDesc("Mesa"))
                .extracting(Loadout::getName)
                .containsExactly("Three");
    }

    @Test
    void updatingColorsReplacesTheChannelRows() {
        Loadout saved = repository.saveAndFlush(newLoadout("Volt", "Storm"));
        var red = LoadoutFixtures.request("Volt", "Storm");
        saved.update("Volt", "Storm", "Tenno", saved.getAttachments(), LoadoutMapper.toColors(red.colorState()));
        saved.getColors().put(ColorChannel.PRIMARY, new ColorChoice("Tenno", 1, 2, "#ff0000", "Tenno C2"));
        repository.saveAndFlush(saved);
        em.clear();

        Loadout found = repository.findWithColorsById(saved.getId()).orElseThrow();
        assertThat(found.getColors()).hasSize(8);
        assertThat(found.getColors().get(ColorChannel.PRIMARY).getHex()).isEqualTo("#ff0000");
        assertThat(found.getVersion()).isEqualTo(1);
    }

    private static Loadout newLoadout(String frame, String name) {
        var request = LoadoutFixtures.request(frame, name);
        Loadout loadout = new Loadout(frame);
        loadout.update(
                frame,
                name,
                request.creator(),
                LoadoutMapper.toAttachments(request.attachments()),
                LoadoutMapper.toColors(request.colorState()));
        return loadout;
    }
}
