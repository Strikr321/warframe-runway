package dev.sublok.runway.user;

import static org.assertj.core.api.Assertions.assertThat;

import dev.sublok.runway.TestcontainersConfiguration;
import dev.sublok.runway.loadout.LoadoutFixtures;
import dev.sublok.runway.loadout.LoadoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class UserServiceTest {

    @Autowired
    UserService service;

    @Autowired
    AppUserRepository users;

    @Autowired
    LoadoutRepository loadouts;

    @BeforeEach
    void clean() {
        loadouts.deleteAll();
        users.deleteAll();
    }

    @Test
    void firstSignInCreatesTheAccount() {
        AppUser user = service.recordLogin("sub-1", "a@example.com", "A", "https://img/a.png");

        assertThat(users.findByGoogleSubject("sub-1")).isPresent();
        assertThat(user.getAvatarUrl()).isEqualTo("https://img/a.png");
    }

    @Test
    void laterSignInsUpdateTheProfileWithoutCreatingAnotherAccount() {
        AppUser first = service.recordLogin("sub-1", "old@example.com", "Old Name", null);
        AppUser again = service.recordLogin("sub-1", "new@example.com", "New Name", null);

        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(users.count()).isEqualTo(1);
        assertThat(again.getEmail()).isEqualTo("new@example.com");
    }

    @Test
    void theFirstAccountAdoptsLoadoutsSavedBeforeAccountsExisted() {
        loadouts.saveAndFlush(LoadoutFixtures.entity(null, "Volt", "From before sign-in"));

        AppUser first = service.recordLogin("sub-1", "a@example.com", "A", null);
        service.recordLogin("sub-2", "b@example.com", "B", null);

        assertThat(loadouts.findAll())
                .allSatisfy(l -> assertThat(l.getOwnerId()).isEqualTo(first.getId()));
    }

    @Test
    void laterAccountsDoNotAdoptAnything() {
        service.recordLogin("sub-1", "a@example.com", "A", null);
        loadouts.saveAndFlush(LoadoutFixtures.entity(null, "Volt", "From before sign-in"));

        service.recordLogin("sub-2", "b@example.com", "B", null);

        assertThat(loadouts.findAll())
                .allSatisfy(l -> assertThat(l.getOwnerId()).isNull());
    }
}
