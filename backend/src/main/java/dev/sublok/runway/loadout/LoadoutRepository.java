package dev.sublok.runway.loadout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Every read is scoped to an owner, so one account can never see another's loadouts. */
public interface LoadoutRepository extends JpaRepository<Loadout, UUID> {

    /** Colors are fetched in the same query to avoid one extra query per loadout. */
    @EntityGraph(attributePaths = "colors")
    List<Loadout> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    @EntityGraph(attributePaths = "colors")
    List<Loadout> findByOwnerIdAndFrameOrderByUpdatedAtDesc(UUID ownerId, String frame);

    @EntityGraph(attributePaths = "colors")
    Optional<Loadout> findWithColorsByIdAndOwnerId(UUID id, UUID ownerId);

    long countByOwnerIdAndFrame(UUID ownerId, String frame);

    /** Gives loadouts created before accounts existed to {@code ownerId}. Returns how many. */
    @Modifying
    @Query("update Loadout l set l.ownerId = :ownerId where l.ownerId is null")
    int adoptUnowned(@Param("ownerId") UUID ownerId);
}
