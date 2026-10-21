// Light/dark theme choice, saved in localStorage. Without a saved choice the site follows the system setting.
export const THEME_KEY = "laluanku_theme";

/** Runs before first paint (inlined in <head>) so a saved theme never flashes the wrong colours. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
