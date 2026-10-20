package dev.sublok.runway.loadout;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/**
 * The API contract for loadouts. Request and response shapes are records, kept separate from the
 * JPA entity so the database model can change without breaking clients.
 */
public final class LoadoutDtos {

    private LoadoutDtos() {}

    public record LoadoutRequest(
            @NotBlank @Size(max = 40) String frame,
            @NotBlank @Size(max = 60) String name,
            @NotBlank @Size(max = 40) String creator,
            @NotNull @Valid AttachmentsDto attachments,
            @NotNull @Valid ColorStateDto colorState) {}

    public record LoadoutResponse(
            UUID id,
            String frame,
            String name,
            String creator,
            boolean favorite,
            AttachmentsDto attachments,
            ColorStateDto colorState,
            Instant createdAt,
            Instant updatedAt) {}

    public record FavoriteRequest(@NotNull Boolean favorite) {}

    public record AttachmentsDto(
            @NotNull @Size(max = 80) String skin,
            @NotNull @Size(max = 80) String helmet,
            @NotNull @Size(max = 80) String chest,
            @NotNull @Size(max = 80) String arms,
            @NotNull @Size(max = 80) String legs,
            @NotNull @Size(max = 80) String ephemera,
            @NotNull @Size(max = 80) String signa,
            @NotNull @Size(max = 80) String syandana) {}

    /** All eight channels are required. Field names match the web client's channel keys. */
    public record ColorStateDto(
            @NotNull @Valid ColorChoiceDto primary,
            @NotNull @Valid ColorChoiceDto secondary,
            @NotNull @Valid ColorChoiceDto tertiary,
            @NotNull @Valid ColorChoiceDto accents,
            @NotNull @Valid ColorChoiceDto em1,
            @NotNull @Valid ColorChoiceDto em2,
            @NotNull @Valid ColorChoiceDto en1,
            @NotNull @Valid ColorChoiceDto en2) {}

    public record ColorChoiceDto(
            @NotBlank @Size(max = 60) String palette,
            @Min(0) @Max(17) int row,
            @Min(0) @Max(4) int col,

            @NotNull @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "must be a #rrggbb hex color")
            String hex,

            @NotNull @Size(max = 60) String label) {}
}
