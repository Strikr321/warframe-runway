package dev.sublok.runway.loadout;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One palette swatch picked for a channel: which palette, its grid cell, and the resolved color. */
@Embeddable
public class ColorChoice {

    @Column(name = "palette", nullable = false, length = 60)
    private String palette;

    @Column(name = "row_index", nullable = false)
    private short row;

    @Column(name = "col_index", nullable = false)
    private short col;

    @Column(name = "hex", nullable = false, length = 7)
    @JdbcTypeCode(SqlTypes.CHAR)
    private String hex;

    @Column(name = "label", nullable = false, length = 60)
    private String label;

    protected ColorChoice() {
        // for JPA
    }

    public ColorChoice(String palette, int row, int col, String hex, String label) {
        this.palette = palette;
        this.row = (short) row;
        this.col = (short) col;
        this.hex = hex;
        this.label = label;
    }

    public String getPalette() {
        return palette;
    }

    public int getRow() {
        return row;
    }

    public int getCol() {
        return col;
    }

    public String getHex() {
        return hex;
    }

    public String getLabel() {
        return label;
    }
}
