package dev.sublok.runway.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** An account, created on first Google sign-in and refreshed on each later one. */
@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    private UUID id;

    @Column(name = "google_subject", nullable = false, unique = true)
    private String googleSubject;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_login_at", nullable = false)
    private Instant lastLoginAt;

    protected AppUser() {
        // for JPA
    }

    public AppUser(String googleSubject, Instant now) {
        this.id = UUID.randomUUID();
        this.googleSubject = googleSubject;
        this.createdAt = now;
        this.lastLoginAt = now;
    }

    /** Google profile fields can change between sign-ins; keep the latest. */
    public void recordLogin(String email, String displayName, String avatarUrl, Instant now) {
        this.email = email;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.lastLoginAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getGoogleSubject() {
        return googleSubject;
    }

    public String getEmail() {
        return email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }
}
