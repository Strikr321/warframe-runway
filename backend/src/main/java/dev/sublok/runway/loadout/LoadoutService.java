package dev.sublok.runway.loadout;

import dev.sublok.runway.loadout.LoadoutDtos.LoadoutRequest;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loadout use cases and business rules, always on behalf of one owner. The only writer of loadouts. */
@Service
@Transactional
public class LoadoutService {

    /** Matches the web client: the Collection card's fan-out stops reading clearly past a hexagon. */
    public static final int MAX_LOADOUTS_PER_FRAME = 6;

    private final LoadoutRepository repository;

    public LoadoutService(LoadoutRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<LoadoutResponse> list(UUID ownerId, String frame) {
        List<Loadout> loadouts = frame == null
                ? repository.findByOwnerIdOrderByUpdatedAtDesc(ownerId)
                : repository.findByOwnerIdAndFrameOrderByUpdatedAtDesc(ownerId, frame);
        return loadouts.stream().map(LoadoutMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public LoadoutResponse get(UUID ownerId, UUID id) {
        return LoadoutMapper.toResponse(find(ownerId, id));
    }

    public LoadoutResponse create(UUID ownerId, LoadoutRequest request) {
        requireRoomFor(ownerId, request.frame());
        Loadout loadout = new Loadout(ownerId, request.frame());
        apply(loadout, request);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public LoadoutResponse update(UUID ownerId, UUID id, LoadoutRequest request) {
        Loadout loadout = find(ownerId, id);
        // Moving a loadout to another frame counts against that frame's cap.
        if (!loadout.getFrame().equals(request.frame())) requireRoomFor(ownerId, request.frame());
        apply(loadout, request);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public LoadoutResponse setFavorite(UUID ownerId, UUID id, boolean favorite) {
        Loadout loadout = find(ownerId, id);
        loadout.setFavorite(favorite);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public void delete(UUID ownerId, UUID id) {
        repository.delete(find(ownerId, id));
    }

    /** Another account's loadout is reported as not found, so ids can't be probed. */
    private Loadout find(UUID ownerId, UUID id) {
        return repository.findWithColorsByIdAndOwnerId(id, ownerId).orElseThrow(() -> new LoadoutNotFoundException(id));
    }

    private void requireRoomFor(UUID ownerId, String frame) {
        if (repository.countByOwnerIdAndFrame(ownerId, frame) >= MAX_LOADOUTS_PER_FRAME) {
            throw new LoadoutLimitExceededException(frame, MAX_LOADOUTS_PER_FRAME);
        }
    }

    private static void apply(Loadout loadout, LoadoutRequest request) {
        loadout.update(
                request.frame().trim(),
                request.name().trim(),
                request.creator().trim(),
                LoadoutMapper.toAttachments(request.attachments()),
                LoadoutMapper.toColors(request.colorState()));
    }
}
