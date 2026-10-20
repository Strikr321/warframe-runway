package dev.sublok.runway.loadout;

import dev.sublok.runway.loadout.LoadoutDtos.AttachmentsDto;
import dev.sublok.runway.loadout.LoadoutDtos.ColorChoiceDto;
import dev.sublok.runway.loadout.LoadoutDtos.ColorStateDto;
import dev.sublok.runway.loadout.LoadoutDtos.LoadoutResponse;
import java.util.EnumMap;
import java.util.Map;

/** Converts between the API records and the JPA model. */
final class LoadoutMapper {

    private LoadoutMapper() {}

    static LoadoutResponse toResponse(Loadout loadout) {
        return new LoadoutResponse(
                loadout.getId(),
                loadout.getFrame(),
                loadout.getName(),
                loadout.getCreator(),
                loadout.isFavorite(),
                toDto(loadout.getAttachments()),
                toDto(loadout.getColors()),
                loadout.getCreatedAt(),
                loadout.getUpdatedAt());
    }

    static Attachments toAttachments(AttachmentsDto dto) {
        return new Attachments(
                dto.skin(),
                dto.helmet(),
                dto.chest(),
                dto.arms(),
                dto.legs(),
                dto.ephemera(),
                dto.signa(),
                dto.syandana());
    }

    static Map<ColorChannel, ColorChoice> toColors(ColorStateDto dto) {
        Map<ColorChannel, ColorChoice> colors = new EnumMap<>(ColorChannel.class);
        colors.put(ColorChannel.PRIMARY, toChoice(dto.primary()));
        colors.put(ColorChannel.SECONDARY, toChoice(dto.secondary()));
        colors.put(ColorChannel.TERTIARY, toChoice(dto.tertiary()));
        colors.put(ColorChannel.ACCENTS, toChoice(dto.accents()));
        colors.put(ColorChannel.EMISSIVE_1, toChoice(dto.em1()));
        colors.put(ColorChannel.EMISSIVE_2, toChoice(dto.em2()));
        colors.put(ColorChannel.ENERGY_1, toChoice(dto.en1()));
        colors.put(ColorChannel.ENERGY_2, toChoice(dto.en2()));
        return colors;
    }

    private static AttachmentsDto toDto(Attachments a) {
        return new AttachmentsDto(
                a.getSkin(),
                a.getHelmet(),
                a.getChest(),
                a.getArms(),
                a.getLegs(),
                a.getEphemera(),
                a.getSigna(),
                a.getSyandana());
    }

    private static ColorStateDto toDto(Map<ColorChannel, ColorChoice> colors) {
        return new ColorStateDto(
                toDto(colors.get(ColorChannel.PRIMARY)),
                toDto(colors.get(ColorChannel.SECONDARY)),
                toDto(colors.get(ColorChannel.TERTIARY)),
                toDto(colors.get(ColorChannel.ACCENTS)),
                toDto(colors.get(ColorChannel.EMISSIVE_1)),
                toDto(colors.get(ColorChannel.EMISSIVE_2)),
                toDto(colors.get(ColorChannel.ENERGY_1)),
                toDto(colors.get(ColorChannel.ENERGY_2)));
    }

    private static ColorChoice toChoice(ColorChoiceDto dto) {
        return new ColorChoice(dto.palette(), dto.row(), dto.col(), dto.hex(), dto.label());
    }

    private static ColorChoiceDto toDto(ColorChoice c) {
        return new ColorChoiceDto(c.getPalette(), c.getRow(), c.getCol(), c.getHex(), c.getLabel());
    }
}
