package dev.sublok.runway.loadout;

import dev.sublok.runway.loadout.LoadoutDtos.FavoriteRequest;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutRequest;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/loadouts")
public class LoadoutController {

    private final LoadoutService service;

    public LoadoutController(LoadoutService service) {
        this.service = service;
    }

    /** All loadouts, most recently updated first; optionally only one frame's. */
    @GetMapping
    public List<LoadoutResponse> list(@RequestParam(required = false) String frame) {
        return service.list(frame);
    }

    @GetMapping("/{id}")
    public LoadoutResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<LoadoutResponse> create(@Valid @RequestBody LoadoutRequest request) {
        LoadoutResponse created = service.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    public LoadoutResponse update(@PathVariable UUID id, @Valid @RequestBody LoadoutRequest request) {
        return service.update(id, request);
    }

    @PutMapping("/{id}/favorite")
    public LoadoutResponse setFavorite(@PathVariable UUID id, @Valid @RequestBody FavoriteRequest request) {
        return service.setFavorite(id, request.favorite());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
