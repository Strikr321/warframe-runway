package dev.sublok.runway.user;

import dev.sublok.runway.loadout.LoadoutRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final AppUserRepository users;
    private final LoadoutRepository loadouts;
    private final Clock clock;

    public UserService(AppUserRepository users, LoadoutRepository loadouts, Clock clock) {
        this.users = users;
        this.loadouts = loadouts;
        this.clock = clock;
    }

    /**
     * Creates the account on first sign-in, otherwise refreshes its profile. The very first account
     * also adopts loadouts saved before accounts existed, so the original owner keeps them.
     */
    public AppUser recordLogin(String googleSubject, String email, String displayName, String avatarUrl) {
        var now = clock.instant();
        AppUser user = users.findByGoogleSubject(googleSubject).orElse(null);
        boolean isNew = user == null;
        if (isNew) user = new AppUser(googleSubject, now);
        user.recordLogin(email, displayName, avatarUrl, now);
        user = users.saveAndFlush(user);

        if (isNew && users.count() == 1) {
            int adopted = loadouts.adoptUnowned(user.getId());
            if (adopted > 0) log.info("First account adopted {} loadouts created before sign-in existed", adopted);
        }
        return user;
    }

    @Transactional(readOnly = true)
    public Optional<AppUser> find(UUID id) {
        return users.findById(id);
    }
}
