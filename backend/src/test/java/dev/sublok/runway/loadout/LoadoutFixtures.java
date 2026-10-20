package dev.sublok.runway.loadout;

import dev.sublok.runway.loadout.LoadoutDtos.AttachmentsDto;
import dev.sublok.runway.loadout.LoadoutDtos.ColorChoiceDto;
import dev.sublok.runway.loadout.LoadoutDtos.ColorStateDto;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutRequest;
import java.util.UUID;

/** Valid request payloads for tests, as objects and as JSON. */
public final class LoadoutFixtures {

    private LoadoutFixtures() {}

    /** A complete, unsaved loadout entity owned by {@code ownerId} (null = from before accounts). */
    public static Loadout entity(UUID ownerId, String frame, String name) {
        LoadoutRequest request = request(frame, name);
        Loadout loadout = new Loadout(ownerId, frame);
        loadout.update(
                frame,
                name,
                request.creator(),
                LoadoutMapper.toAttachments(request.attachments()),
                LoadoutMapper.toColors(request.colorState()));
        return loadout;
    }

    static LoadoutRequest request(String frame, String name) {
        ColorChoiceDto gold = new ColorChoiceDto("Tenno", 0, 0, "#c8a030", "Tenno A1");
        return new LoadoutRequest(
                frame,
                name,
                "Tenno",
                new AttachmentsDto("Prime", "", "", "", "", "Arachnia", "", "Volca"),
                new ColorStateDto(gold, gold, gold, gold, gold, gold, gold, gold));
    }

    static String json(String frame, String name) {
        return json(frame, name, "#c8a030");
    }

    /** A request body whose eight channels all use {@code hex}. */
    static String json(String frame, String name, String hex) {
        String color = """
                {"palette":"Tenno","row":0,"col":0,"hex":"%s","label":"Tenno A1"}""".formatted(hex);
        return """
                {
                  "frame": "%s",
                  "name": "%s",
                  "creator": "Tenno",
                  "attachments": {"skin":"Prime","helmet":"","chest":"","arms":"","legs":"",
                                  "ephemera":"Arachnia","signa":"","syandana":"Volca"},
                  "colorState": {"primary":%s,"secondary":%s,"tertiary":%s,"accents":%s,
                                 "em1":%s,"em2":%s,"en1":%s,"en2":%s}
                }
                """.formatted(frame, name, color, color, color, color, color, color, color, color);
    }
}
