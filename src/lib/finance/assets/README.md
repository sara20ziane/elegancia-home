# Document font (OFL-1.1)

EleganciaDocument-Regular.ttf is a renamed, merged derivative of the static
Noto Sans Regular and Noto Naskh Arabic Regular fonts. Their copyright and SIL
Open Font License are retained in OFL.txt. No font from a restrictive application
reference was copied.

Sources consulted on 2026-11-02:
- https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf
- https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf
- https://github.com/notofonts/noto-fonts/blob/main/LICENSE

Built with fontTools.merge.Merger, renaming name IDs 1, 2, 3, 4 and 6 to
Elegancia Document / Regular / Elegancia Document Regular 1.0 /
Elegancia Document Regular / EleganciaDocument-Regular. The merged font combines
French accents and Arabic glyph shaping in mixed customer fields and table cells.
fontTools is an offline build tool, not an application dependency.

The app embeds this fixed font in the server-generated PDF. Browser WOFF2 variable
fonts were evaluated but rejected after a real PDF subsetting failure. Keep this
asset with renderer v1 so future font or renderer changes cannot affect archived PDFs.
