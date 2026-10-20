package dev.sublok.runway.loadout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoadoutRepository extends JpaRepository<Loadout, UUID> {

    /** Colors are fetched in the same query to avoid one extra query per loadout. */
    @EntityGraph(attributePaths = "colors")
    List<Loadout> findAllByOrderByUpdatedAtDesc();

    @EntityGraph(attributePaths = "colors")
    List<Loadout> findByFrameOrderByUpdatedAtDesc(String frame);

    @EntityGraph(attributePaths = "colors")
    Optional<Loadout> findWithColorsById(UUID id);

    long countByFrame(String frame);
}
