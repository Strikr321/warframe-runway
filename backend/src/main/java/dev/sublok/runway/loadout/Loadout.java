package dev.sublok.runway.loadout;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** A saved fashion loadout for one Warframe: names, attachments and all eight color channels. */
@Entity
@Table(name = "loadout")
public class Loadout {

    @Id
    private UUID id;

    @Column(nullable = false, length = 40)
    private String frame;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 40)
    private String creator;

    @Column(nullable = false)
    private boolean favorite;

    @Embedded
    private Attachments attachments;

    @ElementCollection
    @CollectionTable(name = "loadout_color", joinColumns = @JoinColumn(name = "loadout_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "channel", length = 16)
    private Map<ColorChannel, ColorChoice> colors = new HashMap<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Optimistic locking: a stale concurrent update fails instead of silently overwriting.
     * A wrapper type, so a null version tells Spring Data the entity is new (persist, not merge).
     */
    @Version
    private Long version;

    protected Loadout() {
        // for JPA
    }

    public Loadout(String frame) {
        this.id = UUID.randomUUID();
        this.frame = frame;
    }

    public void update(
            String frame, String name, String creator, Attachments attachments, Map<ColorChannel, ColorChoice> colors) {
        this.frame = frame;
        this.name = name;
        this.creator = creator;
        this.attachments = attachments;
        // Mutate the managed collection rather than replacing it, so Hibernate tracks the change.
        this.colors.clear();
        this.colors.putAll(colors);
    }

    public UUID getId() {
        return id;
    }

    public String getFrame() {
        return frame;
    }

    public String getName() {
        return name;
    }

    public String getCreator() {
        return creator;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public Attachments getAttachments() {
        return attachments;
    }

    public Map<ColorChannel, ColorChoice> getColors() {
        return colors;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getVersion() {
        return version;
    }
}
