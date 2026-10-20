package dev.sublok.runway.loadout;

import static dev.sublok.runway.loadout.LoadoutService.MAX_LOADOUTS_PER_FRAME;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LoadoutServiceTest {

    @Mock
    LoadoutRepository repository;

    @InjectMocks
    LoadoutService service;

    @Test
    void createRejectsAFrameAtTheCap() {
        when(repository.countByFrame("Volt")).thenReturn((long) MAX_LOADOUTS_PER_FRAME);

        assertThatThrownBy(() -> service.create(LoadoutFixtures.request("Volt", "Seventh")))
                .isInstanceOf(LoadoutLimitExceededException.class)
                .hasMessageContaining("Volt");
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void createTrimsInputAndMapsEveryChannel() {
        when(repository.countByFrame("Volt")).thenReturn(0L);
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        var created = service.create(LoadoutFixtures.request("Volt", "  Storm  "));

        assertThat(created.name()).isEqualTo("Storm");
        assertThat(created.colorState().en2().hex()).isEqualTo("#c8a030");
        assertThat(created.attachments().syandana()).isEqualTo("Volca");
    }

    @Test
    void updateWithinTheSameFrameIsAllowedAtTheCap() {
        Loadout existing = existing("Volt");
        when(repository.findWithColorsById(existing.getId())).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        var updated = service.update(existing.getId(), LoadoutFixtures.request("Volt", "Renamed"));

        assertThat(updated.name()).isEqualTo("Renamed");
        verify(repository, never()).countByFrame(any());
    }

    @Test
    void movingALoadoutToAFullFrameIsRejected() {
        Loadout existing = existing("Volt");
        when(repository.findWithColorsById(existing.getId())).thenReturn(Optional.of(existing));
        when(repository.countByFrame("Mesa")).thenReturn((long) MAX_LOADOUTS_PER_FRAME);

        assertThatThrownBy(() -> service.update(existing.getId(), LoadoutFixtures.request("Mesa", "Moved")))
                .isInstanceOf(LoadoutLimitExceededException.class);
    }

    @Test
    void missingLoadoutIsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findWithColorsById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(LoadoutNotFoundException.class);
        assertThatThrownBy(() -> service.delete(id)).isInstanceOf(LoadoutNotFoundException.class);
    }

    private static Loadout existing(String frame) {
        Loadout loadout = new Loadout(frame);
        var request = LoadoutFixtures.request(frame, "Original");
        loadout.update(
                frame,
                request.name(),
                request.creator(),
                LoadoutMapper.toAttachments(request.attachments()),
                LoadoutMapper.toColors(request.colorState()));
        return loadout;
    }
}
