import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? null);
