package dev.sublok.runway.loadout;

public class LoadoutLimitExceededException extends RuntimeException {

    public LoadoutLimitExceededException(String frame, int max) {
        super(frame + " already has " + max + " loadouts, the maximum");
    }
}
