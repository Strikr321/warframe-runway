package dev.sublok.runway.loadout;

import dev.sublok.runway.loadout.LoadoutDtos.LoadoutRequest;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Loadout use cases and business rules. Controllers call this; it is the only writer of loadouts. */
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
    public List<LoadoutResponse> list(String frame) {
        List<Loadout> loadouts = frame == null
                ? repository.findAllByOrderByUpdatedAtDesc()
                : repository.findByFrameOrderByUpdatedAtDesc(frame);
        return loadouts.stream().map(LoadoutMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public LoadoutResponse get(UUID id) {
        return LoadoutMapper.toResponse(find(id));
    }

    public LoadoutResponse create(LoadoutRequest request) {
        requireRoomFor(request.frame());
        Loadout loadout = new Loadout(request.frame());
        apply(loadout, request);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public LoadoutResponse update(UUID id, LoadoutRequest request) {
        Loadout loadout = find(id);
        // Moving a loadout to another frame counts against that frame's cap.
        if (!loadout.getFrame().equals(request.frame())) requireRoomFor(request.frame());
        apply(loadout, request);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public LoadoutResponse setFavorite(UUID id, boolean favorite) {
        Loadout loadout = find(id);
        loadout.setFavorite(favorite);
        return LoadoutMapper.toResponse(repository.saveAndFlush(loadout));
    }

    public void delete(UUID id) {
        repository.delete(find(id));
    }

    private Loadout find(UUID id) {
        return repository.findWithColorsById(id).orElseThrow(() -> new LoadoutNotFoundException(id));
    }

    private void requireRoomFor(String frame) {
        if (repository.countByFrame(frame) >= MAX_LOADOUTS_PER_FRAME) {
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
