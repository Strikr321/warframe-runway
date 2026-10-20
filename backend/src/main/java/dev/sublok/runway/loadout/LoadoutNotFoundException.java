package dev.sublok.runway.loadout;

import java.util.UUID;

public class LoadoutNotFoundException extends RuntimeException {

    public LoadoutNotFoundException(UUID id) {
        super("Loadout " + id + " not found");
    }
}
