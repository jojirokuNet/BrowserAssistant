import { flattenNestedObj } from '../lib/helpers';

import { LANGUAGES } from './langConstants';
import af from './af/messages.json';
import ar from './ar/messages.json';
import be from './be/messages.json';
import bg from './bg/messages.json';
import bnIN from './bn-IN/messages.json';
import bn from './bn/messages.json';
import ca from './ca/messages.json';
import cs from './cs/messages.json';
import da from './da/messages.json';
import de from './de/messages.json';
import el from './el/messages.json';
import en from './en/messages.json';
import es from './es/messages.json';
import et from './et/messages.json';
import fa from './fa/messages.json';
import fi from './fi/messages.json';
import fr from './fr/messages.json';
import he from './he/messages.json';
import hi from './hi/messages.json';
import hr from './hr/messages.json';
import hu from './hu/messages.json';
import id from './id/messages.json';
import it from './it/messages.json';
import iw from './iw/messages.json';
import ja from './ja/messages.json';
import ko from './ko/messages.json';
import ku from './ku/messages.json';
import lt from './lt/messages.json';
import ms from './ms/messages.json';
import nl from './nl/messages.json';
import nb from './nb/messages.json';
import pl from './pl/messages.json';
import pt_BR from './pt_BR/messages.json';
import ptPT from './pt-PT/messages.json';
import ro from './ro/messages.json';
import ru from './ru/messages.json';
import sk from './sk/messages.json';
import sl from './sl/messages.json';
import sr from './sr/messages.json';
import srLatn from './sr-Latn/messages.json';
import sv from './sv/messages.json';
import th from './th/messages.json';
import tr from './tr/messages.json';
import uk from './uk/messages.json';
import urPK from './ur-PK/messages.json';
import vi from './vi/messages.json';
import zh_CN from './zh_CN/messages.json';
import zh_TW from './zh_TW/messages.json';
import zhHK from './zh-HK/messages.json';

/**
 * A locale dictionary in Chrome i18n format:
 * message id → entry carrying the translated `message` string.
 */
type MessagesDictionary = Record<string, { message: string; description?: string }>;

type LanguageCode = keyof typeof LANGUAGES;

type MessagesMap = Record<string, Record<string, string>>;

/**
 * Statically imported dictionaries keyed by the twosky language code,
 * so the bundler includes every locale without a dynamic require.
 * Typing against `keyof typeof LANGUAGES` makes tsc fail if a twosky
 * language ever lacks a matching import here.
 */
const dictionaries: Record<LanguageCode, MessagesDictionary> = {
    af,
    ar,
    be,
    bg,
    'bn-IN': bnIN,
    bn,
    ca,
    cs,
    da,
    de,
    el,
    en,
    es,
    et,
    fa,
    fi,
    fr,
    he,
    hi,
    hr,
    hu,
    id,
    it,
    iw,
    ja,
    ko,
    ku,
    lt,
    ms,
    nl,
    nb,
    pl,
    pt_BR,
    'pt-PT': ptPT,
    ro,
    ru,
    sk,
    sl,
    sr,
    'sr-Latn': srLatn,
    sv,
    th,
    tr,
    uk,
    'ur-PK': urPK,
    vi,
    zh_CN,
    zh_TW,
    'zh-HK': zhHK,
};

/**
 * Map of lower-cased locale code → flattened message id → translated
 * string. Shape, key set, and key order are identical to the previous
 * dynamic-require implementation: keys come from the twosky language
 * list in its declared order.
 */
const messagesMap: MessagesMap = (Object.keys(LANGUAGES) as LanguageCode[])
    .reduce((acc, language) => {
        const dictionary = dictionaries[language];
        const lowerCasedLanguageKey = language.toLocaleLowerCase();
        acc[lowerCasedLanguageKey] = flattenNestedObj(dictionary, 'message');
        return acc;
    }, {} as MessagesMap);

export default messagesMap;
