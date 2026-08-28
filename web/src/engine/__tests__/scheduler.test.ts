import { describe, expect, it } from 'vitest';
import { requiredNodes } from '../closure';
import { buildIndex } from '../graph';
import { schedule } from '../scheduler';
import { nodeId } from '../types';
import { fixtureCatalog, freshState } from './fixtures';

const index = buildIndex(fixtureCatalog);
const opts = { builders: 1, buildingSpeedPct: 0, researchSpeedPct: 0 };
const goalHall3 = [{ type: 'building' as const, id: 'hall', level: 3 }];

describe('schedule', () => {
  it('ì„ í–‰ì¡°ê±´ ìœ„ë°˜ ì—†ìŒ: ëª¨ë“  íƒœìŠ¤í¬ëŠ” deps ì™„ë£Œ í›„ ì‹œìž‘', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    const endOf = new Map(tasks.map((t) => [t.key, t.endSec]));
    for (const t of tasks) {
      for (const d of nodes.get(t.key)!.deps) {
        expect(t.startSec).toBeGreaterThanOrEqual(endOf.get(d)!);
      }
    }
  });

  it('ê±´ì„¤ìž 1ëª… ì§ë ¬: ì´ì‹œê°„ = ëª¨ë“  ê±´ì„¤ ì‹œê°„ í•©', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, opts);
    // wall1(50)+wall2(60)+hall2(100)+academy1(80)+hall3(200) = 490
    expect(Math.max(...tasks.map((t) => t.endSec))).toBe(490);
  });

  it('ê±´ì„¤ìž 2ëª…ì´ë©´ ë³‘ë ¬í™”ë¡œ ë‹¨ì¶•ëœë‹¤', () => {
    const nodes = requiredNodes(index, goalHall3, freshState());
    const tasks = schedule(nodes, { ...opts, builders: 2 });
    expect(Math.max(...tasks.map((t) => t.endSec))).toBeLessThan(490);
  });

  it('ì—°êµ¬ëŠ” ì—°êµ¬ íì—ì„œ ê±´ì„¤ê³¼ ë³‘ë ¬ ì§„í–‰', () => {
    const nodes = requiredNodes(index,
      [...goalHall3, { type: 'research' as const, id: 'masonry', level: 2 }], freshState());
    const tasks6ã¶¶‰žËkºwµçV–ÆF–ærrbbvöÂæ–BÓÓÒv6—G•ö†ÆÂp¢bbvöÂæÆWfVÂÓÓÒ&W6WDÆWfVÂ’òv7F—fRr¢rwÐ¢öä6Æ–6³×²‚’ÓâFDvöÂ‡²G—S¢v'V–ÆF–ærrÂ–C¢v6—G•ö†ÆÂrÂÆWfVÃ¢&W6WDÆWfVÂÒ—Óà¢Æ–Ör7&3×¶–6öåW&Â‚v'V–ÆF–ærrÂv6—G•ö†ÆÂr—ÒÇCÒ""óà¢Ç7ãç·B‚vvöÇ2æ6—G”†ÆÅFòrÂ²ã¢&W6WDÆWfVÂÒ—ÓÂ÷7ãà¢Âö'WGFöãà¢’—Ð¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&6FÆör×FööÆ&"#à¢ÆF—b6Æ74æÖSÒ'6VvÖVçFVB#à¢Æ'WGFöâ6Æ74æÖS×¶¶–æBÓÓÒv'V–ÆF–ærròv7F—fRr¢rwÐ¢öä6Æ–6³×²‚’Óâ6†ö÷6T¶–æB‚v'V–ÆF–ærr—Óç·B‚v6—G’æ'V–ÆF–æw2r—ÓÂö'WGFöãà¢Æ'WGFöâ6Æ74æÖS×¶¶–æBÓÓÒw&W6V&6‚ròv7F—fRr¢rwÐ¢öä6Æ–6³×²‚’Óâ6†ö÷6T¶–æB‚w&W6V&6‚r—Óç·B‚v6—G’ç&W6V&6‚r—ÓÂö'WGFöãà¢ÂöF—cà¢ÆÆ&VÂ6Æ74æÖSÒ'6V&6‚Öf–VÆB#à¢Ç7â&–Ö†–FFVãÒ'G'VR#î(ÉSÂ÷7ãà¢Æ–çWBfÇVS×·VW'—Òöä6†ævS×²†WfVçB’Óâ6WEVW'’†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#×·B‚vvöÇ2ç6V&6‚r—Ò&–ÖÆ&VÃ×·B‚vvöÇ2ç6V&6‚r—Òóà¢ÂöÆ&VÃà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&vöÂÖ6FÆör#à¢¶f–ÇFW&VDVçG&–W2æÖ‚†VçG'’’Óâ°¢6öç7BW†—7F–ærÒvöÇ2æf–æB‚†vöÂ’ÓâvöÂçG—RÓÓÒ¶–æBbbvöÂæ–BÓÓÒVçG'’æ–B“°¢&WGW&â€¢Æ'WGFöâ¶W“×¶VçG'’æ–GÐ¢6Æ74æÖS×¶vöÂÖ÷F–öâG·6VÆV7FVBæ–BÓÓÒVçG'’æ–Bòw6VÆV7FVBr¢rwÒG¶W†—7F–æròvFFVBr¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6†ö÷6TVçG'’†VçG'’—Óà¢Ç7â6Æ74æÖSÒ&vöÂÖ–6öâ×w&#à¢Æ–Ör7&3×¶–6öåW&Â†¶–æBÂVçG'’æ–B—ÒÇCÒ""ÆöF–æsÒ&Æ§’"óà¢¶W†—7F–ærbbÇ7â6Æ74æÖSÒ&vöÂÖÆWfVÂÖ&FvR#ç¶W†—7F–æræÆWfVÇÓÂ÷7ãçÐ¢Â÷7ãà¢Ç7ãç¶æÖR†VçG'’æ–B—ÓÂ÷7ãà¢Ç6ÖÆÃç·B‚vvöÇ2æÖ„ÆWfVÂrÂ²ã¢VçG'’æÖ„ÆWfVÂÒ—ÓÂ÷6ÖÆÃà¢Âö'WGFöãà¢“°¢Ò—Ð¢¶f–ÇFW&VDVçG&–W2æÆVæwF‚ÓÓÒbbÇ6Æ74æÖSÒ&V×G’×6V&6‚#ç·B‚vvöÇ2ææôÖF6†W2r—ÓÂ÷çÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&vöÂÖVF—F÷"#à¢Æ–Ör7&3×¶–6öåW&Â†¶–æBÂ6VÆV7FVBæ–B—ÒÇCÒ""óà¢ÆF—b6Æ74æÖSÒ&vöÂÖVF—F÷"ÖæÖR#ãÇ6ÖÆÃç·B‚vvöÇ2çF&vWBr—ÓÂ÷6ÖÆÃãÇ7G&öæsç¶æÖR‡6VÆV7FVBæ–B—ÓÂ÷7G&öæsãÂöF—cà¢ÆÆ&VÃç·B‚vvöÇ2çF&vWDÆWfVÂr—Ð¢Ç6VÆV7BfÇVS×´ÖF‚æÖ–â†ÆWfVÂÂ6VÆV7FVBæÖ„ÆWfVÂ—Ð¢öä6†ævS×²†WfVçB’Óâ6WDÆWfVÂ„çVÖ&W"†WfVçBçF&vWBçfÇVR’—Óà¢´'&’æg&öÒ‡²ÆVæwFƒ¢6VÆV7FVBæÖ„ÆWfVÂÒÂ…òÂ–æFW‚’Óâ€¢Æ÷F–öâ¶W“×¶–æFW‚²ÒfÇVS×¶–æFW‚²Óç·B‚vÆWfVÂr—×¶–æFW‚²ÓÂö÷F–öãà¢’—Ð¢Â÷6VÆV7Cà¢ÂöÆ&VÃà¢Æ'WGFöâ6Æ74æÖSÒ'&–Ö'’Ö'WGFöâ ¢öä6Æ–6³×²‚’ÓâFDvöÂ‡²G—S¢¶–æBÂ–C¢6VÆV7FVBæ–BÂÆWfVÃ¢ÖF‚æÖ–â†ÆWfVÂÂ6VÆV7FVBæÖ„ÆWfVÂ’Ò—Óà¢·B‚vvöÇ2æFBr—Ð¢Âö'WGFöãà¢ÂöF—cà¢Â÷6V7F–öãà ¢Ç6V7F–öâ6Æ74æÖSÒ'6VÆV7FVBÖvöÇ2×æVÂ#à¢ÆF—b6Æ74æÖSÒ'6V7F–öâÖ†VF–ær6ö×7BÖ†VF–ær#à¢ÆF—cãÇ7â6Æ74æÖSÒ'7FWÖçVÖ&W"#ã#Â÷7ããÆF—cãÆƒ#ç·B‚vvöÇ2ç6VÆV7FVBr—ÓÂöƒ#ãÂöF—cãÂöF—cà¢ÂöF—cà¢¶vöÇ2æÆVæwF‚ÓÓÒòÇ6Æ74æÖSÒ&V×G’×7FFR#ç·B‚vvöÇ2æV×G’r—ÓÂ÷â¢€¢ÆF—b6Æ74æÖSÒ'6VÆV7FVBÖvöÇ2#à¢¶vöÇ2æÖ‚†vöÂ’Óâ€¢ÆF—b6Æ74æÖSÒ'6VÆV7FVBÖvöÂ"¶W“×¶G¶vöÂçG—WÓ¢G¶vöÂæ–GÖÓà¢Æ–Ör7&3×¶–6öåW&Â†vöÂçG—RÂvöÂæ–B—ÒÇCÒ""óà¢Ç7ããÇ7G&öæsç¶æÖR†vöÂæ–B—ÓÂ÷7G&öæsãÇ6ÖÆÃç·B‚vÆWfVÂr—×¶vöÂæÆWfVÇÓÂ÷6ÖÆÃãÂ÷7ãà¢Æ'WGFöâ&–ÖÆ&VÃ×¶G¶æÖR†vöÂæ–B—ÒG·B‚vvöÇ2ç&VÖ÷fRr—ÖÐ¢öä6Æ–6³×²‚’Óâ6WDvöÇ2†vöÇ2æf–ÇFW"‚†—FVÒ’Óâ—FVÒÓÒvöÂ’—Óì9sÂö'WGFöãà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢—Ð¢Â÷6V7F–öãà¢ÂöF—cà¢“°§Ð 