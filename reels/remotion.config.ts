import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
Config.setChromiumOpenGlRenderer("swangle");
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? null);
