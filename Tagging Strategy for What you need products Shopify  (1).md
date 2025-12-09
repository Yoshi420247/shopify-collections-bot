what\\\_you\\\_need\\\_tagging\\\_spec:    
  spec\\\_name: "What You Need smokeshop tagging and collections"    
  version: "1.1"    
  last\\\_updated: "2025-12-09"

  context: |    
    Scope

    \- This spec covers only products where the Shopify "Vendor" column equals "What You Need".  
    \- These are all smokeshop items: glass and silicone devices, rigs, bubblers, hand pipes, one hitters, nectar collectors, quartz, torches, rolling papers, grinders, tools, electronic pieces, packaging, and accessories.  
    \- Oil Slick and Hand Made Apparel are out of scope here and should use their own spec.

    Reset policy

    \- All existing tags on What You Need products should be treated as legacy and removed from the live store.  
    \- The LLM may read existing tags in the CSV as a weak hint during classification but must not output any of the old tag formats such as "c:", "f:", "b:", "sc:", "made-in-usa".  
    \- The new tags must follow the dimensions and patterns described in this document only.

    Goal

    \- Give every What You Need product a clean, consistent tag set that:  
      \- Makes device and accessory families obvious.  
      \- Powers new Shopify smart collections defined later in this spec.  
      \- Makes filtering by material, use case, joint details, brand, and pack size straightforward.  
    \- The spec is written to be read by an LLM and used as a reference "database" of tagging and collection logic.

  input\\\_schema: |    
    CSV structure and fields to use

    The export file "WYN\_PRODUCT\_EXPORT\_TAGGED.csv" contains one row per product for the What You Need vendor.

    Required columns the LLM should rely on:

    \- Handle  
      \- Unique product key.  
      \- Use this to tie the generated tags back to the product.  
    \- Vendor  
      \- Only process rows where Vendor equals "What You Need".  
    \- Title  
      \- Short name that usually carries the functional type, size, material, and brand.  
      \- Example patterns: "13 HIGHWAY COLOR FUME ACCENT TWIN TURBO RATCHET", "ZIG ZAG ROSE CONES CARTON 3 Pack".  
    \- Body (HTML)  
      \- Long description in HTML.  
      \- Often includes:  
        \- Exact sizes (inches, millimeters).  
        \- Material callouts such as borosilicate glass, quartz, silicone, wood, titanium, ceramic, metal.  
        \- Use case language such as dabbing, flower piece, daily driver, travel, multi use.  
        \- Pack counts and what is included.  
        \- Brand names and series names.  
    \- Type  
      \- High level merchandising category from Shopify, for example:  
        \- Bongs & Water Pipes  
        \- Dab Rigs / Oil Rigs  
        \- Hand Pipes  
        \- One Hitters & Chillums  
        \- Bubblers  
        \- Flower Bowls  
        \- Dab Tools / Dabbers  
        \- Carb Caps  
        \- Grinders  
        \- Rolling Papers  
        \- Nectar Collectors & Straws  
        \- Torches  
        \- Electronics  
        \- Essentials & Accessories  
        \- Quadrant types like Quartz, Silicone, Made In Usa, Wyn Brands, Pendants, Packaging  
      \- For functional types such as Bongs & Water Pipes, treat Type as a strong hint about the family.  
      \- For theme types such as Quartz, Silicone, Made In Usa, Wyn Brands, treat Type as a theme flag and determine the true family from Title and Body (HTML).  
    \- Product Category  
      \- Google product category mapping. Use as a secondary hint if helpful, but do not depend on it.  
    \- Tags  
      \- May contain legacy tags such as "c:Bongs & Water Pipes", "f:material:glass", "b:RAW", "sc:Zig Zag" in older exports.  
      \- Use these only as weak hints while you transition the catalog.  
      \- Never emit any of these legacy tags in your new output.

    Optional but useful columns:

    \- Variant Price  
      \- Can be used in future to build price tier collections, but it does not affect tagging.  
    \- Image fields and SEO fields  
      \- Not needed for tagging in this spec.

  tag\\\_dimensions: |    
    Overview

    \- All new tags are plain strings in the Shopify Tags field.  
    \- Tags are structured as "dimension:value" where "dimension" is a stable prefix and "value" is a lowercase slug with hyphens.  
    \- Example tags:  
      \- pillar:smokeshop-device  
      \- family:glass-bong  
      \- material:glass  
      \- brand:raw  
      \- use:flower-smoking  
      \- joint\_size:14mm  
      \- bundle:3-pack  
    \- Never output commas inside a tag string.  
    \- Multiple tags per product are expected. Tags must all follow the patterns described below.

    Dimension 1: pillar

    \- Purpose: top level grouping that distinguishes complete devices, accessories, packaging, and merch.  
    \- Tag format: "pillar:\<slug\>".  
    \- Exactly one pillar tag per product.

    Allowed values:

    \- pillar:smokeshop-device  
      \- Complete smokable or dab ready devices that a consumer can use directly.  
      \- Examples: bongs, dab rigs, bubblers, hand pipes, one hitters and chillums, nectar collectors, electronic nectar collectors, vaporizers.  
    \- pillar:accessory  
      \- Items that support or modify a device and do not function alone.  
      \- Examples: flower bowls, carb caps, quartz bangers, grinders, dab tools, torches, trays, ash catchers, downstems, joint bubblers, rolling funnels, matches, display stands.  
    \- pillar:packaging  
      \- Boxes, jars, or other items whose primary job is packaging for resale or storage rather than the session itself.  
      \- In the What You Need data this mainly covers branded boxes or display packaging.  
    \- pillar:merch  
      \- Decorative or wearable brand items that are not primarily session hardware.  
      \- Examples: pendants that are not used as carb caps, art only glass that is not meant to be used.

    Dimension 2: family

    \- Purpose: functional product family used for navigation and onsite collections.  
    \- Tag format: "family:\<slug\>".  
    \- Exactly one family tag per product.  
    \- The family tag answers "What is this piece?" at a practical level.

    Allowed family values for What You Need products:

    \- family:glass-bong  
      \- Glass water pipes intended primarily for flower or hybrid use.  
    \- family:silicone-bong  
      \- Bongs where silicone is the primary structural material.  
    \- family:glass-rig  
      \- Glass dab rigs and recycler style rigs.  
    \- family:silicone-rig  
      \- Rigs where silicone is the primary structural material.  
    \- family:bubbler  
      \- Standalone bubblers for flower or hybrid use.  
    \- family:joint-bubbler  
      \- Bubblers designed specifically to be used in line with a joint or pre roll.  
    \- family:spoon-pipe  
      \- Hand pipes, spoons, sherlocks, steamrollers, hammers and similar dry pipes.  
    \- family:chillum-onehitter  
      \- One hitters, chillums, taster bats and similar minimal dry pieces.  
    \- family:nectar-collector  
      \- Manual nectar collectors and straws used for concentrates.  
    \- family:flower-bowl  
      \- Bowl slides for bongs and rigs that are intended for flower.  
    \- family:carb-cap  
      \- Carb caps of any shape, including pendants that are explicitly carb caps.  
    \- family:banger  
      \- Quartz bangers and similar concentrate joints including slurpers and tower styles.  
    \- family:dab-tool  
      \- Dab tools and dabbers, including heady or branded tools.  
    \- family:grinder  
      \- Flower grinders of any material.  
    \- family:rolling-paper  
      \- Rolling papers, booklets, single wide, one and a quarter, king size, plus pre rolled cones and specialty papers.  
    \- family:tray  
      \- Rolling trays and concentrate pads that function as a workspace for rolling or packing.  
    \- family:torch  
      \- Handheld torches used for dabbing or lighting.  
    \- family:ash-catcher  
      \- Ash catchers and ash catcher like attachments for water pipes.  
    \- family:downstem  
      \- Downstems sold separately from the bong.  
    \- family:rolling-accessory  
      \- Rolling related accessories such as cone loaders, funnel fillers, matchbooks intended for lighting.  
    \- family:storage-accessory  
      \- Jars, boxes, stash containers, and similar storage items that are not a core device.  
    \- family:vape-battery  
      \- Standalone batteries or mods for cartridges or electronic rigs.  
    \- family:vape-coil  
      \- Replacement coils or atomizers for electronic devices.  
    \- family:electronic-nectar-collector  
      \- Electronic nectar collectors and similar powered dab straws.  
    \- family:merch-pendant  
      \- Pendants and chains that are primarily decorative and not sold as carb caps.

    Dimension 3: brand

    \- Purpose: capture the consumer facing brand printed on the product or box.  
    \- Tag format: "brand:\<slug\>" where value is lowercase and uses hyphens for spaces.  
    \- At most one brand tag per product.

    Known brand values in this catalog:

    \- brand:raw  
    \- brand:zig-zag  
    \- brand:vibes  
    \- brand:elements  
    \- brand:cookies  
    \- brand:lookah  
    \- brand:puffco  
    \- brand:maven  
    \- brand:g-pen  
    \- brand:only-quartz  
    \- brand:eo-vape  
    \- brand:monark  
    \- brand:710-sci  
    \- brand:peaselburg  
    \- brand:scorch

    Rules for brand:

    \- Derive brand from Title and Body (HTML). Use all caps words or brand names that shoppers recognize.  
    \- If there is no obvious third party brand, do not add a brand tag.  
    \- If a product clearly belongs to another brand that is not in the list, add a new slug such as "brand:empire-glassworks" following the same pattern.

    Dimension 4: material

    \- Purpose: describe the main material or materials that matter to the shopper.  
    \- Tag format: "material:\<slug\>".  
    \- One or two material tags per product is normal.

    Allowed material values:

    \- material:glass  
    \- material:borosilicate  
    \- material:quartz  
    \- material:silicone  
    \- material:metal  
    \- material:stainless-steel  
    \- material:titanium  
    \- material:ceramic  
    \- material:wood  
    \- material:stone  
    \- material:acrylic  
    \- material:plastic  
    \- material:hybrid

    Rules:

    \- If the copy explicitly says borosilicate use both material:glass and material:borosilicate.  
    \- For silicone rigs or bongs that have glass insets, use both material:silicone and material:glass.  
    \- Use material:metal for generic metal. Use material:stainless-steel or material:titanium when the copy is specific.  
    \- Use material:hybrid only if multiple materials are equally dominant and it is not useful to list them all.

    Dimension 5: format

    \- Purpose: shape or physical format of the product.  
    \- Tag format: "format:\<slug\>".  
    \- Exactly one format tag per product.

    Allowed values:

    \- format:bong  
    \- format:rig  
    \- format:pipe  
    \- format:bubbler  
    \- format:nectar-collector  
    \- format:banger  
    \- format:cap  
    \- format:tool  
    \- format:grinder  
    \- format:torch  
    \- format:paper  
    \- format:tray  
    \- format:jar  
    \- format:box  
    \- format:coil  
    \- format:battery-mod  
    \- format:accessory  
    \- format:pendant

    Dimension 6: use

    \- Purpose: main jobs and use cases.  
    \- Tag format: "use:\<slug\>".  
    \- One or two use tags per product.

    Allowed values:

    \- use:flower-smoking  
      \- Pieces and accessories used with flower only.  
    \- use:dabbing  
      \- Pieces and accessories used with concentrates only.  
    \- use:multi-use  
      \- Devices suited for both flower and concentrates where the copy clearly encourages both.  
    \- use:rolling  
      \- Papers, cones, and rolling accessories.  
    \- use:setup-protection  
      \- Ash catchers, joint bubblers, trays and similar items that protect the main piece or surface.  
    \- use:storage  
      \- Storage jars, stash containers, boxes.  
    \- use:preparation  
      \- Grinders, cone loaders, funnel fillers, and similar prep tools.

    Dimension 7: joint\_size

    \- Purpose: capture ground joint size where clearly stated.  
    \- Tag format: "joint\_size:\<value\>".  
    \- Allowed values are "10mm", "14mm", "18mm".  
    \- Extract from Title or Body patterns such as "10mm", "14mm", "18mm", and shorthand like "10M", "14M", "18F".

    Dimension 8: joint\_angle

    \- Purpose: capture joint angle where clearly stated.  
    \- Tag format: "joint\_angle:\<value\>".  
    \- Allowed values are "45" and "90".  
    \- Read from patterns like "45 degree", "45", "90 degree", "90".

    Dimension 9: joint\_gender

    \- Purpose: capture male or female joint where clearly stated.  
    \- Tag format: "joint\_gender:\<value\>".  
    \- Allowed values are "male" and "female".  
    \- Extract from "male", "female", "M", "F" in context of joints.

    Dimension 10: length

    \- Purpose: capture overall length for pipes, chillums, nectar collectors and other long accessories where stated.  
    \- Tag format: "length:\<number\>in".  
    \- Example tags: "length:3in", "length:4in", "length:5in", "length:7in".  
    \- Only add this when the length is clear in Title or Body (HTML).

    Dimension 11: capacity

    \- Purpose: capture volume for packaging and storage items where stated.  
    \- Tag format: "capacity:\<value\>".  
    \- Example tags: "capacity:5ml", "capacity:10ml", "capacity:3oz".  
    \- Use milliliters for smaller capacity jars. Use ounces where that is how the product is sold.

    Dimension 12: style

    \- Purpose: cross cutting style and story tags.  
    \- Tag format: "style:\<slug\>".

    Common values:

    \- style:made-in-usa  
      \- Pieces that are sold in the catalog under Made In Usa or that clearly state Made in USA in copy.  
    \- style:heady  
      \- One of a kind or limited art pieces explicitly described as heady, collab work, or art glass.  
    \- style:animal  
      \- Pieces that are clearly animal or character themed, including dragons, sharks, owls, turtles, minions and similar.  
    \- style:brand-highlight  
      \- Hero items for a brand such as signature Monark or Cookies pieces promoted in Wyn Brands.  
    \- style:travel-friendly  
      \- Pieces described in copy as pocket sized, travel ready, or discrete daily carry.  
    \- style:discreet-profile  
      \- Pieces that are explicitly described as low profile or discreet.

    Dimension 13: bundle

    \- Purpose: describe pack size and merchandising case where relevant.  
    \- Tag format: "bundle:\<slug\>".

    Patterns:

    \- Use "bundle:single" for individual pieces.  
    \- For obvious pack sizes use "bundle:\<number\>-pack", such as:  
      \- bundle:2-pack  
      \- bundle:3-pack  
      \- bundle:5-pack  
      \- bundle:9-pack  
      \- bundle:24-pack  
      \- bundle:50-pack  
    \- For cartons or display boxes where the count is very high, use:  
      \- bundle:display-box  
      \- bundle:bulk-case

  product\\\_family\\\_rules: |    
    General mapping approach

    \- For functional Shopify Types such as "Bongs & Water Pipes", "Dab Rigs / Oil Rigs", "Bubblers", "Hand Pipes", "One Hitters & Chillums", "Flower Bowls", "Dab Tools / Dabbers", "Carb Caps", "Grinders", "Rolling Papers", "Nectar Collectors & Straws", "Torches", "Electronics", "Essentials & Accessories":  
      \- Treat Type as the primary hint for family and pillar.  
      \- Confirm and refine with Title and Body (HTML) to pick glass versus silicone and determine use.

    \- For theme Types such as "Made In Usa", "Wyn Brands", "Quartz", "Silicone", "Pendants", "Packaging":  
      \- Treat Type as a theme or additional attribute, not the functional family.  
      \- Determine the true family from the language in Title and Body (HTML).  
      \- Always add style tags where relevant, such as style:made-in-usa or style:brand-highlight.

    Per Type rules

    1\. Type: Bongs & Water Pipes

    \- pillar: always pillar:smokeshop-device.  
    \- family:  
      \- If Title or Body mention silicone as the main material, set family:silicone-bong.  
      \- Otherwise, assume glass and set family:glass-bong.  
    \- material:  
      \- Always include material:glass for glass bongs.  
      \- Add material:silicone when the piece has a silicone body or major silicone components.  
    \- format: format:bong.  
    \- use:  
      \- Default to use:flower-smoking.  
      \- If the copy explicitly calls out using a banger for dabs as well as flower and presents that as a real use case, upgrade to use:multi-use.  
    \- Joint details:  
      \- Parse 10mm, 14mm, 18mm and degree language from Title and copy and add joint\_size, joint\_angle, and joint\_gender tags when they are clear.

    2\. Type: Dab Rigs / Oil Rigs

    \- pillar: pillar:smokeshop-device.  
    \- family:  
      \- If the construction is silicone forward, use family:silicone-rig.  
      \- Otherwise use family:glass-rig.  
    \- material:  
      \- As with bongs, use material:glass and material:silicone as appropriate.  
    \- format: format:rig.  
    \- use:  
      \- Default to use:dabbing.  
      \- If the rig is explicitly positioned as a flower and dab hybrid, or the copy repeatedly mentions flower bowls and dabs together, use use:multi-use.  
    \- Style:  
      \- Mark obviously heady collab rigs as style:heady.  
      \- When the rig is part of a highlighted series in Wyn Brands, add style:brand-highlight.

    3\. Type: Bubblers

    \- pillar: pillar:smokeshop-device.  
    \- family:  
      \- Use family:bubbler for stand alone bubblers.  
      \- Use family:joint-bubbler when the piece is clearly sold as an attachment for joints or pre rolls.  
    \- material:  
      \- Usually material:glass.  
      \- Add other materials if clearly stated.  
    \- format: format:bubbler.  
    \- use:  
      \- Default to use:flower-smoking.  
      \- For joint bubblers add use:setup-protection in addition to use:flower-smoking.

    4\. Type: Hand Pipes

    \- pillar: pillar:smokeshop-device.  
    \- family:  
      \- Use family:spoon-pipe for spoons, sherlocks, steamrollers, hammer pipes and other dry hand pipes.  
    \- material:  
      \- Glass pieces get material:glass and optionally material:borosilicate.  
      \- Silicone hand pipes get material:silicone, and material:glass when there is a glass bowl.  
    \- format: format:pipe.  
    \- use:  
      \- use:flower-smoking.

    5\. Type: One Hitters & Chillums

    \- pillar: pillar:smokeshop-device.  
    \- family: family:chillum-onehitter.  
    \- material:  
      \- Use material:glass, material:metal, or other materials as stated.  
    \- format: format:pipe.  
    \- use: use:flower-smoking.  
    \- length:  
      \- Add length tags for clear inch measurements such as 3 inch or 4 inch.

    6\. Type: Nectar Collectors & Straws

    \- pillar: pillar:smokeshop-device.  
    \- family: family:nectar-collector.  
    \- material:  
      \- Often material:glass or material:quartz, sometimes both.  
    \- format: format:nectar-collector.  
    \- use: use:dabbing.  
    \- length:  
      \- Add length tags when the piece length is clearly specified.

    7\. Type: Flower Bowls

    \- pillar: pillar:accessory.  
    \- family: family:flower-bowl.  
    \- material:  
      \- Usually material:glass; use material:borosilicate if called out.  
    \- format: format:accessory.  
    \- use: use:flower-smoking.  
    \- Joint details:  
      \- Always capture joint\_size, joint\_angle, and joint\_gender when described.

    8\. Type: Carb Caps

    \- pillar: pillar:accessory.  
    \- family: family:carb-cap.  
    \- material:  
      \- Most are material:glass or material:quartz.  
    \- format: format:cap.  
    \- use: use:dabbing.  
    \- Pendants:  
      \- If a carb cap is described as a pendant carb cap, keep family:carb-cap and you may add style tags if desired.

    9\. Type: Dab Tools / Dabbers

    \- pillar: pillar:accessory.  
    \- family: family:dab-tool.  
    \- material:  
      \- Use material:metal, material:stainless-steel, material:quartz, or material:glass as appropriate.  
    \- format: format:tool.  
    \- use: use:dabbing.  
    \- Style:  
      \- Heady branded dab tools can also carry style:heady.

    10\. Type: Grinders

    \- pillar: pillar:accessory.  
    \- family: family:grinder.  
    \- material:  
      \- Use material:metal, material:wood, or material:plastic as copy indicates.  
    \- format: format:grinder.  
    \- use: use:flower-smoking.  
    \- bundle:  
      \- Multi pack grinder displays should use bundle tags such as bundle:6-pack or bundle:display-box when obvious.

    11\. Type: Rolling Papers

    \- pillar: pillar:accessory.  
    \- family: family:rolling-paper.  
    \- material:  
      \- If the copy calls out special materials such as hemp, rice, or rose petals, you can leave material unspecified or use a generic material tag if desired. Material is less important for papers in this spec.  
    \- format: format:paper.  
    \- use: use:rolling.  
    \- brand:  
      \- Use brand:raw, brand:zig-zag, brand:vibes, brand:elements as appropriate.  
    \- bundle:  
      \- For booklets, cones, cartons and displays, convert counts into bundle tags like bundle:3-pack, bundle:24-pack, bundle:display-box.

    12\. Type: Torches

    \- pillar: pillar:accessory.  
    \- family: family:torch.  
    \- material:  
      \- Use material:metal and material:plastic where casing materials are clear.  
    \- format: format:torch.  
    \- use:  
      \- use:dabbing.  
      \- If the copy emphasizes lighting flower as well, you may add use:flower-smoking, but use:dabbing is the core.

    13\. Type: Quartz

    \- Treat "Quartz" as a theme, not a functional family.  
    \- Most products in this type are bangers and related concentrate joints.

    Rules:

    \- pillar: pillar:accessory.  
    \- family:  
      \- Use family:banger for bangers, slurpers, and other concentrate joints.  
      \- In rare cases where the product is clearly a carb cap, use family:carb-cap.  
    \- material:  
      \- Use material:quartz.  
    \- format:  
      \- format:banger for bangers, format:cap for carb caps.  
    \- use: use:dabbing.  
    \- Joint details:  
      \- Parse joint size, angle, and gender and add joint tags.

    14\. Type: Electronics

    \- pillar:  
      \- Use pillar:accessory for batteries and coils.  
      \- Use pillar:smokeshop-device for powered devices such as electronic nectar collectors.  
    \- family:  
      \- Use family:vape-battery for cartridge or mod batteries.  
      \- Use family:vape-coil for coil or atomizer packs.  
      \- Use family:electronic-nectar-collector for powered nectar collector devices.  
    \- material:  
      \- material:metal is sufficient for most electronics.  
    \- format:  
      \- format:battery-mod for batteries.  
      \- format:coil for coils.  
      \- format:nectar-collector for electronic nectar collectors.  
    \- use:  
      \- use:dabbing.

    15\. Type: Essentials & Accessories

    \- This is a mixed group. The LLM must inspect Title and Body (HTML) to classify each product into a real family.

    Common patterns:

    \- Ash catchers:  
      \- pillar: pillar:accessory.  
      \- family: family:ash-catcher.  
      \- format: format:accessory.  
      \- use: use:setup-protection plus use:flower-smoking.  
      \- Add joint tags when specified.  
    \- Downstems:  
      \- pillar: pillar:accessory.  
      \- family: family:downstem.  
      \- format: format:accessory.  
      \- use: use:flower-smoking.  
    \- Joint bubblers:  
      \- pillar: pillar:smokeshop-device.  
      \- family: family:joint-bubbler.  
      \- format: format:bubbler.  
      \- use: use:flower-smoking and use:setup-protection.  
    \- Cone loaders and funnel fillers:  
      \- pillar: pillar:accessory.  
      \- family: family:rolling-accessory.  
      \- format: format:accessory.  
      \- use: use:rolling.  
    \- Custom matches and similar consumables:  
      \- pillar: pillar:accessory.  
      \- family: family:rolling-accessory.  
      \- format: format:accessory.  
      \- use: use:rolling.

    16\. Type: Silicone

    \- Treat "Silicone" as a theme Type that should be resolved into real families.

    Rules:

    \- Determine whether the product is a bong, rig, hand pipe, or accessory from Title and Body (HTML).  
    \- Set pillar, family, format, and use using the same rules as the underlying family.  
    \- Always add material:silicone and material:glass where appropriate.

    17\. Type: Pendants

    \- For pendants that are clearly carb caps:  
      \- pillar: pillar:accessory.  
      \- family: family:carb-cap.  
      \- format: format:cap.  
      \- use: use:dabbing.  
      \- Add style:heady when they are heady art pieces.  
    \- For decorative pendants that are not meant as carb caps:  
      \- pillar: pillar:merch.  
      \- family: family:merch-pendant.  
      \- format: format:pendant.  
      \- use: no use tag is required.

    18\. Type: Packaging

    \- pillar: pillar:packaging.  
    \- family:  
      \- Use family:storage-accessory for jar boxes, stash containers, and similar.  
    \- format:  
      \- Use format:box or format:jar as appropriate.  
    \- use:  
      \- use:storage.  
    \- capacity and bundle:  
      \- Extract ml or oz capacity and pack count when present and add capacity and bundle tags.

    19\. Type: Made In Usa

    \- Treat this as a style and story Type, not a functional family.

    Rules:

    \- Determine whether the product is a rig, bong, bubbler, pipe, pendant carb cap, etc by looking at Title and Body (HTML).  
    \- Set pillar, family, material, format, and use according to the underlying function.  
    \- Always add style:made-in-usa.  
    \- Add style:heady when the piece is clearly one of a kind art glass or a collab.

    20\. Type: Wyn Brands

    \- This Type groups special branded or highlighted products.

    Rules:

    \- Classify each product into a functional family based on the same rules used for Type based families.  
    \- Add style:brand-highlight for signature or hero line items.  
    \- Set brand tags for brands such as cookies, monark, and similar.

  collections: |    
    Overview

    \- Collections are built on top of the new tag system.  
    \- The rules below describe which tags should be used to define each collection in Shopify smart collection conditions.  
    \- In Shopify the actual implementation will use "Product tag equals" conditions that match the tags described here.

    Core navigation collections

    1\. Bongs

    \- Name: Bongs  
    \- Purpose: all bongs and water pipes primarily used for flower or hybrid use.  
    \- Include products that have:  
      \- family:glass-bong OR family:silicone-bong.

    2\. Dab Rigs

    \- Name: Dab Rigs  
    \- Purpose: all rigs for dabbing and hybrid use.  
    \- Include products that have:  
      \- family:glass-rig OR family:silicone-rig.

    3\. Bubblers

    \- Name: Bubblers  
    \- Purpose: all standalone bubblers.  
    \- Include products that have:  
      \- family:bubbler OR family:joint-bubbler.

    4\. Hand Pipes

    \- Name: Hand Pipes  
    \- Purpose: spoons, sherlocks, steamrollers, hammers and similar dry pipes.  
    \- Include products that have:  
      \- family:spoon-pipe.

    5\. One Hitters and Chillums

    \- Name: One Hitters and Chillums  
    \- Purpose: one hitters, taster bats and chillums.  
    \- Include products that have:  
      \- family:chillum-onehitter.

    6\. Nectar Collectors

    \- Name: Nectar Collectors  
    \- Purpose: nectar collectors and straws, including electronic nectar collectors that behave like straws.  
    \- Include products that have:  
      \- family:nectar-collector OR family:electronic-nectar-collector.

    7\. Flower Bowls

    \- Name: Flower Bowls  
    \- Purpose: slide bowls for bongs and rigs.  
    \- Include products that have:  
      \- family:flower-bowl.

    8\. Quartz Bangers and Nails

    \- Name: Quartz Bangers  
    \- Purpose: all bangers and similar concentrate joints.  
    \- Include products that have:  
      \- family:banger.

    9\. Carb Caps

    \- Name: Carb Caps  
    \- Purpose: all caps used with bangers.  
    \- Include products that have:  
      \- family:carb-cap.

    10\. Dab Tools

    \- Name: Dab Tools  
    \- Purpose: dabbers and specialized concentrate tools.  
    \- Include products that have:  
      \- family:dab-tool.

    11\. Grinders

    \- Name: Grinders  
    \- Purpose: flower grinders.  
    \- Include products that have:  
      \- family:grinder.

    12\. Rolling Papers and Cones

    \- Name: Rolling Papers and Cones  
    \- Purpose: all papers, booklets, and cones.  
    \- Include products that have:  
      \- family:rolling-paper.

    13\. Rolling Accessories

    \- Name: Rolling Accessories  
    \- Purpose: cone loaders, funnel fillers, matches, and other rolling helpers.  
    \- Include products that have:  
      \- family:rolling-accessory.

    14\. Trays and Work Surfaces

    \- Name: Trays and Work Surfaces  
    \- Purpose: rolling trays and similar surfaces.  
    \- Include products that have:  
      \- family:tray.

    15\. Torches

    \- Name: Torches  
    \- Purpose: all dab torches.  
    \- Include products that have:  
      \- family:torch.

    16\. Ash Catchers and Downstems

    \- Name: Ash Catchers and Downstems  
    \- Purpose: filtration and attachment hardware for bongs and rigs.  
    \- Include products that have:  
      \- family:ash-catcher OR family:downstem.

    17\. Vapes and Electronics

    \- Name: Vapes and Electronics  
    \- Purpose: batteries, coils and powered nectar collectors.  
    \- Include products that have:  
      \- family:vape-battery OR family:vape-coil OR family:electronic-nectar-collector.

    18\. Packaging and Storage

    \- Name: Packaging and Storage  
    \- Purpose: jars, boxes and similar storage items.  
    \- Include products that have:  
      \- family:storage-accessory OR pillar:packaging.

    19\. Pendants and Merch

    \- Name: Pendants and Merch  
    \- Purpose: decorative pendants and non hardware merch.  
    \- Include products that have:  
      \- family:merch-pendant OR pillar:merch.

    Brand collections

    1\. RAW

    \- Name: RAW Collection  
    \- Purpose: all RAW brand rolling products and accessories.  
    \- Include products that have:  
      \- brand:raw.

    2\. Zig Zag

    \- Name: Zig Zag Collection  
    \- Purpose: all Zig Zag rolling papers and cones.  
    \- Include products that have:  
      \- brand:zig-zag.

    3\. Vibes

    \- Name: Vibes Collection  
    \- Include products that have:  
      \- brand:vibes.

    4\. Elements

    \- Name: Elements Collection  
    \- Include products that have:  
      \- brand:elements.

    5\. Cookies

    \- Name: Cookies Collection  
    \- Purpose: highlighted Cookies bongs and rigs as well as any accessories.  
    \- Include products that have:  
      \- brand:cookies.

    6\. Lookah

    \- Name: Lookah Collection  
    \- Include products that have:  
      \- brand:lookah.

    7\. Puffco

    \- Name: Puffco Collection  
    \- Include products that have:  
      \- brand:puffco.

    8\. Other brands

    \- Similar brand collections can be created for Maven, G Pen, Only Quartz, EO Vape, Monark, 710 SCI, Peaselburg, Scorch and any future brands by including products that carry the matching brand tag.

    Theme collections

    1\. Made In USA Glass

    \- Name: Made In USA Glass  
    \- Purpose: showcase domestic production glass.  
    \- Include:  
      \- style:made-in-usa.  
    \- Exclude:  
      \- pillar:packaging and pillar:merch to keep this focused on devices and functional accessories.

    2\. Heady and Art Glass

    \- Name: Heady Glass  
    \- Purpose: highlight high end art and collab pieces.  
    \- Include:  
      \- style:heady.

    3\. Silicone Pieces

    \- Name: Silicone Rigs and Bongs  
    \- Purpose: all silicone forward hard goods.  
    \- Include:  
      \- material:silicone.  
    \- Focus navigation on sub filters by family: silicone rigs, silicone bongs, silicone hand pipes.

    4\. Travel Friendly

    \- Name: Travel Friendly  
    \- Purpose: smaller, pocket and case based pieces.  
    \- Include:  
      \- Any product with style:travel-friendly OR where the copy clearly marks it as compact and travel ready.  
    \- Typically used on hand pipes, chillums, nectar collectors and smaller rigs.

    Global vendor collection

    \- Shop All What You Need  
      \- Name: Shop All What You Need  
      \- Include:  
        \- Product vendor equals "What You Need".

  llm\\\_workflow: |    
    High level process

    \- Work row by row over the CSV.  
    \- For each row where Vendor equals "What You Need", generate a fresh list of tags following the dimensions and rules in this spec.  
    \- Ignore existing tags in the "Tags" column except as weak hints during interpretation.  
    \- Output for each product should be keyed by Handle, with a list of new tags.

    Detailed steps

    1\. Filter by vendor

    \- If Vendor is not "What You Need", skip the row entirely.  
    \- If Vendor is "What You Need", continue.

    2\. Understand the product

    \- Read Title and Body (HTML) carefully.  
    \- Note:  
      \- What the product actually is (bong, rig, hand pipe, carb cap, banger, grinder, torch, papers, electronics, packaging, pendant).  
      \- The main use case (flower, dabs, both, rolling, storage, protection, prep).  
      \- Materials (glass, borosilicate, quartz, silicone, metal, titanium, ceramic, wood, plastic, etc).  
      \- Any explicit joint information such as 10mm, 14mm, 18mm, angle and gender.  
      \- Pack size details such as 3 pack, 5 pack, 9 pack, cartons and display boxes.  
      \- Brand names that the shopper would recognize.  
      \- Style cues such as Made in USA, heady, animal or character themed, travel focused.

    3\. Choose pillar

    \- Apply the pillar rules:  
      \- If it can be seshed from directly, use pillar:smokeshop-device.  
      \- If it supports a device only, use pillar:accessory.  
      \- If it is primarily packaging, use pillar:packaging.  
      \- If it is decorative or merch, use pillar:merch.

    4\. Choose family

    \- Use the "product\_family\_rules" section and the Type value to pick exactly one family tag.  
    \- Resolve theme Types (Made In Usa, Wyn Brands, Quartz, Silicone, Pendants, Packaging) to a functional family based on Title and Body (HTML).  
    \- Never leave a product without a family tag.

    5\. Add brand

    \- Extract the consumer brand from Title and Body (HTML).  
    \- If it matches one of the known brands in this spec, use the corresponding brand tag.  
    \- If no clear brand is present, do not add a brand tag.  
    \- Do not reuse legacy "b:" or "sc:" tags.

    6\. Add material

    \- Based on the description, add one or two material tags:  
      \- Always include material:glass for glass items.  
      \- Add material:borosilicate when clearly called out.  
      \- Add material:quartz for quartz products, especially bangers and some carb caps.  
      \- Add material:silicone when silicone is a main component.  
      \- Use other material values where they are clearly important.

    7\. Add format

    \- Pick exactly one format tag based on physical shape:  
      \- Bongs use format:bong.  
      \- Rigs use format:rig.  
      \- Hand pipes and chillums use format:pipe.  
      \- Bubblers use format:bubbler.  
      \- Nectar collectors use format:nectar-collector.  
      \- Bangers use format:banger.  
      \- Carb caps use format:cap.  
      \- Dab tools use format:tool.  
      \- Rolling papers and cones use format:paper.  
      \- Grinders use format:grinder.  
      \- Torches use format:torch.  
      \- Trays use format:tray.  
      \- Packaging and storage may use format:jar or format:box.  
      \- Electronics use format:battery-mod or format:coil.

    8\. Add use tags

    \- Pick one or two main use tags:  
      \- use:flower-smoking for flower focused pieces and accessories.  
      \- use:dabbing for dab focused pieces and accessories.  
      \- use:multi-use when a device is equally presented for both flower and dabs.  
      \- use:rolling for papers and rolling accessories.  
      \- use:setup-protection for ash catchers, joint bubblers and protective attachments.  
      \- use:storage for storage and stash items.  
      \- use:preparation for grinders and load tools.

    9\. Add joint details

    \- From Title and Body (HTML):  
      \- If joint size is clear, add joint\_size:10mm, joint\_size:14mm or joint\_size:18mm.  
      \- If joint angle is clear, add joint\_angle:45 or joint\_angle:90.  
      \- If joint gender is clear, add joint\_gender:male or joint\_gender:female.  
    \- Do not guess joint details if the copy is ambiguous.

    10\. Add length and capacity

    \- For straws, chillums, nectar collectors and pipes where a clear length in inches is given, add a length tag such as length:4in.  
    \- For packaging and jar related items where capacity is clear, add capacity tags such as capacity:5ml or capacity:3oz.

    11\. Add style

    \- Apply style tags when they are clearly justified:  
      \- style:made-in-usa for products in the Made In Usa Type or copy that states Made in USA.  
      \- style:heady for one of a kind and collab art pieces.  
      \- style:animal for animal or character themed glass.  
      \- style:brand-highlight for hero Wyn Brands items.  
      \- style:travel-friendly for compact, travel focused pieces.  
      \- style:discreet-profile for low profile pieces marketed as discreet.

    12\. Add bundle

    \- Use bundle:single for standalone items.  
    \- When pack size is clear from Title or Body (HTML), create the correct bundle tag:  
      \- bundle:3-pack for 3 pack.  
      \- bundle:5-pack for 5 pack.  
      \- bundle:9-pack for 9 pack torch displays.  
      \- bundle:display-box or bundle:bulk-case for large carton and display cases.

    13\. Final check for each product

    \- Ensure that every What You Need product has at least:  
      \- One pillar tag.  
      \- One family tag.  
      \- One format tag.  
      \- At least one use tag.  
    \- Remove any legacy tags from the suggested output if present in the input.  
    \- Output the new tags as a flat list of strings.

    Example output format for a single product

    \- For each product produce an object with:  
      \- handle: the Handle from the CSV.  
      \- tags: a list of new tag strings.

    Example:

    \- handle: "13-highway-color-fume-accent-twin-turbo-ratchet"  
      tags:  
        \- pillar:smokeshop-device  
        \- family:glass-bong  
        \- material:glass  
        \- format:bong  
        \- use:flower-smoking  
        \- joint\_size:14mm

  examples: |    
    Example 1: Bongs and water pipes

    Source data:

    \- Vendor: What You Need  
    \- Type: Bongs & Water Pipes  
    \- Title: "13 INCH HIGHWAY COLOR FUME ACCENT TWIN TURBO RATCHET"  
    \- Body summary:  
      \- Heady production bong with twin turbo ratchet perc.  
      \- 13 inch height.  
      \- Designed as a daily flower driver, with optional mention that a banger could be used.

    Correct tags:

    \- pillar:smokeshop-device  
    \- family:glass-bong  
    \- material:glass  
    \- format:bong  
    \- use:flower-smoking  
    \- joint\_size:14mm  
    \- style:brand-highlight (only if treated as a hero piece in Wyn Brands, otherwise omit)

    Example 2: Dab rig

    Source data:

    \- Vendor: What You Need  
    \- Type: Dab Rigs / Oil Rigs  
    \- Title: "7 INCH COLOR FUME HORN WAFFLE RIG"  
    \- Body summary:  
      \- Compact heady dab rig with 45 degree 14mm joint.  
      \- Built specifically for dabs.

    Correct tags:

    \- pillar:smokeshop-device  
    \- family:glass-rig  
    \- material:glass  
    \- format:rig  
    \- use:dabbing  
    \- joint\_size:14mm  
    \- joint\_angle:45  
    \- style:heady

    Example 3: Hand pipe

    Source data:

    \- Vendor: What You Need  
    \- Type: Hand Pipes  
    \- Title: "5 INCH DRAGON FRUIT HAND PIPE"  
    \- Body summary:  
      \- Five inch glass spoon pipe with dragon fruit theme.  
      \- Everyday dry flower pipe.

    Correct tags:

    \- pillar:smokeshop-device  
    \- family:spoon-pipe  
    \- material:glass  
    \- format:pipe  
    \- use:flower-smoking  
    \- length:5in  
    \- style:animal (if the sculpt is clearly fruit or character themed)

    Example 4: Quartz banger

    Source data:

    \- Vendor: What You Need  
    \- Type: Quartz  
    \- Title: "14 MALE 90 DEGREE COMPETITION BANGER"  
    \- Body summary:  
      \- High end quartz banger with 14mm male 90 degree joint.

    Correct tags:

    \- pillar:accessory  
    \- family:banger  
    \- material:quartz  
    \- format:banger  
    \- use:dabbing  
    \- joint\_size:14mm  
    \- joint\_angle:90  
    \- joint\_gender:male

    Example 5: Dab tool

    Source data:

    \- Vendor: What You Need  
    \- Type: Dab Tools / Dabbers  
    \- Title: "MIYAGI PAINTS ROUND SESH SCEPTOR DAB TOOL"  
    \- Body summary:  
      \- Heady dab tool with detailed artwork.

    Correct tags:

    \- pillar:accessory  
    \- family:dab-tool  
    \- material:metal (or the specific material if called out)  
    \- format:tool  
    \- use:dabbing  
    \- style:heady

    Example 6: Rolling papers

    Source data:

    \- Vendor: What You Need  
    \- Type: Rolling Papers  
    \- Title: "ZIG ZAG ROSE CONES CARTON 3 Pack"  
    \- Body summary:  
      \- Branded rose petal cones by Zig Zag sold as a 3 pack carton.

    Correct tags:

    \- pillar:accessory  
    \- family:rolling-paper  
    \- brand:zig-zag  
    \- format:paper  
    \- use:rolling  
    \- bundle:3-pack

    Example 7: Torch display

    Source data:

    \- Vendor: What You Need  
    \- Type: Torches  
    \- Title: "MAVEN PRIME TORCH DISPLAY 9 Pack"  
    \- Body summary:  
      \- Nine torch set from Maven in a display box.

    Correct tags:

    \- pillar:accessory  
    \- family:torch  
    \- brand:maven  
    \- material:metal  
    \- format:torch  
    \- use:dabbing  
    \- bundle:9-pack  
    \- style:brand-highlight (if merchandised as a hero display)

    Example 8: Electronic nectar collector

    Source data:

    \- Vendor: What You Need  
    \- Type: Electronics  
    \- Title: "EO VAPE THE BAKER ELECTRONIC NECTAR COLLECTOR"  
    \- Body summary:  
      \- Electronic nectar collector for concentrates.

    Correct tags:

    \- pillar:smokeshop-device  
    \- family:electronic-nectar-collector  
    \- brand:eo-vape  
    \- material:metal  
    \- format:nectar-collector  
    \- use:dabbing

    Example 9: Ash catcher

    Source data:

    \- Vendor: What You Need  
    \- Type: Essentials & Accessories  
    \- Title: "5 INCH CLEAR BARREL ASH CATCHER"  
    \- Body summary:  
      \- Five inch clear glass ash catcher for water pipes.

    Correct tags:

    \- pillar:accessory  
    \- family:ash-catcher  
    \- material:glass  
    \- format:accessory  
    \- use:setup-protection  
    \- use:flower-smoking  
    \- joint\_size:14mm (if specified in the description)  
    \- joint\_angle:90 (if specified)

    Example 10: Made in USA heady rig

    Source data:

    \- Vendor: What You Need  
    \- Type: Made In Usa  
    \- Title: "10 INCH KERBY BOWMAN COLLAB MECH BURD RIG"  
    \- Body summary:  
      \- High end made in USA collab heady rig.

    Correct tags:

    \- pillar:smokeshop-device  
    \- family:glass-rig  
    \- material:glass  
    \- format:rig  
    \- use:dabbing  
    \- style:made-in-usa  
    \- style:heady  
