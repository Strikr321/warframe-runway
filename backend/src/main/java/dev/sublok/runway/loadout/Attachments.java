package dev.sublok.runway.loadout;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Cosmetic attachments; an empty string means "not set". Stored as columns on {@code loadout}. */
@Embeddable
public class Attachments {

    @Column(nullable = false, length = 80)
    private String skin = "";

    @Column(nullable = false, length = 80)
    private String helmet = "";

    @Column(nullable = false, length = 80)
    private String chest = "";

    @Column(nullable = false, length = 80)
    private String arms = "";

    @Column(nullable = false, length = 80)
    private String legs = "";

    @Column(nullable = false, length = 80)
    private String ephemera = "";

    @Column(nullable = false, length = 80)
    private String signa = "";

    @Column(nullable = false, length = 80)
    private String syandana = "";

    protected Attachments() {
        // for JPA
    }

    public Attachments(
            String skin,
            String helmet,
            String chest,
            String arms,
            String legs,
            String ephemera,
            String signa,
            String syandana) {
        this.skin = skin;
        this.helmet = helmet;
        this.chest = chest;
        this.arms = arms;
        this.legs = legs;
        this.ephemera = ephemera;
        this.signa = signa;
        this.syandana = syandana;
    }

    public String getSkin() {
        return skin;
    }

    public String getHelmet() {
        return helmet;
    }

    public String getChest() {
        return chest;
    }

    public String getArms() {
        return arms;
    }

    public String getLegs() {
        return legs;
    }

    public String getEphemera() {
        return ephemera;
    }

    public String getSigna() {
        return signa;
    }

    public String getSyandana() {
        return syandana;
    }
}
