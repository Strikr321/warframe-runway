package dev.sublok.runway.loadout;

import static org.assertj.core.api.Assertions.assertThat;

import dev.sublok.runway.TestcontainersConfiguration;
import dev.sublok.runway.user.AppUser;
import dev.sublok.runway.user.AppUserRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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

    @Autowired
    AppUserRepository users;

    UUID owner;

    @BeforeEach
    void createOwner() {
        owner = newUser("owner").getId();
    }

    private AppUser newUser(String subject) {
        AppUser user = new AppUser(subject, Instant.now());
        user.recordLogin(subject + "@example.com", subject, null, Instant.now());
        return users.saveAndFlush(user);
    }

    @Test
    void persistsAttachmentsAndAllEightColorChannels() {
        Loadout saved = repository.saveAndFlush(newLoadout(owner, "Volt", "Storm"));
        em.clear();

        Loadout found =
                repository.findWithColorsByIdAndOwnerId(saved.getId(), owner).orElseThrow();
        assertThat(found.getColors()).hasSize(8).containsKey(ColorChannel.ENERGY_2);
        assertThat(found.getAttachments().getSyandana()).isEqualTo("Volca");
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getVersion()).isZero();
    }

    @Test
    void countsAndFiltersByFrame() {
        repository.saveAndFlush(newLoadout(owner, "Volt", "One"));
        repository.saveAndFlush(newLoadout(owner, "Volt", "Two"));
        repository.saveAndFlush(newLoadout(owner, "Mesa", "Three"));

        assertThat(repository.countByOwnerIdAndFrame(owner, "Volt")).isEqualTo(2);
        assertThat(repository.findByOwnerIdAndFrameOrderByUpdatedAtDesc(owner, "Mesa"))
                .extracting(Loadout::getName)
                .containsExactly("Three");
    }

    @Test
    void updatingColorsReplacesTheChannelRows() {
        Loadout saved = repository.saveAndFlush(newLoadout(owner, "Volt", "Storm"));
        var red = LoadoutFixtures.request("Volt", "Storm");
        saved.update("Volt", "Storm", "Tenno", saved.getAttachments(), LoadoutMapper.toColors(red.colorState()));
        saved.getColors().put(ColorChannel.PRIMARY, new ColorChoice("Tenno", 1, 2, "#ff0000", "Tenno C2"));
        repository.saveAndFlush(saved);
        em.clear();

        Loadout found =
                repository.findWithColorsByIdAndOwnerId(saved.getId(), owner).orElseThrow();
        assertThat(found.getColors()).hasSize(8);
        assertThat(found.getColors().get(ColorChannel.PRIMARY).getHex()).isEqualTo("#ff0000");
        assertThat(found.getVersion()).isEqualTo(1);
    }

    @Test
    void ownersOnlySeeTheirOwnLoadouts() {
        UUID other = newUser("other").getId();
        Loadout theirs = repository.saveAndFlush(newLoadout(other, "Volt", "Theirs"));

        assertThat(repository.findByOwnerIdOrderByUpdatedAtDesc(owner)).isEmpty();
        assertThat(repository.findWithColorsByIdAndOwnerId(theirs.getId(), owner))
                .isEmpty();
        assertThat(repository.countByOwnerIdAndFrame(owner, "Volt")).isZero();
    }

    @Test
    void adoptUnownedAssignsOnlyLoadoutsWithoutAnOwner() {
        repository.saveAndFlush(newLoadout(null, "Volt", "From before sign-in"));
        repository.saveAndFlush(newLoadout(owner, "Mesa", "Already owned"));
        UUID adopter = newUser("adopter").getId();

        assertThat(repository.adoptUnowned(adopter)).isEqualTo(1);
        em.clear();
        assertThat(repository.findByOwnerIdOrderByUpdatedAtDesc(adopter))
                .extracting(Loadout::getName)
                .containsExactly("From before sign-in");
    }

    private static Loadout newLoadout(UUID ownerId, String frame, String name) {
        return LoadoutFixtures.entity(ownerId, frame, name);
    }
}
