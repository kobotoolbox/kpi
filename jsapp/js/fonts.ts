// Centralized Roboto font imports for both main app and Storybook
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/400-italic.css'
import '@fontsource/roboto/500.css'
// Roboto doesn't have semibold (600) version. We do use 600 font weight a lot in our styles, but they all are rendered
// as weight 700. To have true 600, we would need to switch to variable font Roboto Flex - but this would require more
// refactor, and AFAIK would also not play nicely with Mantine which uses "Roboto" as default font and doesn't seem
// ready for using a variable font.
// import '@fontsource/roboto/600.css'
import '@fontsource/roboto/700.css'
