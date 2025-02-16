import fuzzy from 'fuzzy'
import inquirer from 'inquirer'

import { chalk, log } from './command-helpers.js'

/**
 * Filters the inquirer settings based on the input
 * @param {ReturnType<typeof formatSettingsArrForInquirer>} scriptInquirerOptions
 * @param {string} input
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'scriptInquirerOptions' implicitly has a... Remove this comment to see the full error message
const filterSettings = function (scriptInquirerOptions, input) {
  // @ts-expect-error TS(7006) FIXME: Parameter 'scriptInquirerOption' implicitly has an... Remove this comment to see the full error message
  const filterOptions = scriptInquirerOptions.map((scriptInquirerOption) => scriptInquirerOption.name)
  // TODO: remove once https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1394 is fixed
  // eslint-disable-next-line unicorn/no-array-method-this-argument
  const filteredSettings = fuzzy.filter(input, filterOptions)
  const filteredSettingNames = new Set(
    filteredSettings.map((filteredSetting) => (input ? filteredSetting.string : filteredSetting)),
  )
  // @ts-expect-error TS(7006) FIXME: Parameter 't' implicitly has an 'any' type.
  return scriptInquirerOptions.filter((t) => filteredSettingNames.has(t.name))
}

/** @typedef {import('@netlify/build-info').Settings} Settings */

/**
 * @param {Settings[]} settings
 * @param {'dev' | 'build'} type The type of command (dev or build)
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'settings' implicitly has an 'any' type.
const formatSettingsArrForInquirer = function (settings, type = 'dev') {
  // @ts-expect-error TS(7006) FIXME: Parameter 'setting' implicitly has an 'any' type.
  return settings.map((setting) => {
    const cmd = type === 'dev' ? setting.devCommand : setting.buildCommand
    return {
      name: `[${chalk.yellow(setting.framework.name)}] '${cmd}'`,
      value: { ...setting, commands: [cmd] },
      short: `${setting.name}-${cmd}`,
    }
  })
}

/**
 * Uses @netlify/build-info to detect the dev settings and port based on the framework
 * and the build system that is used.
 * @param {import('../commands/base-command.js').default} command
 * @param {'dev' | 'build'} type The type of command (dev or build)
 * @returns {Promise<Settings | undefined>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
export const detectFrameworkSettings = async (command, type = 'dev') => {
  const { relConfigFilePath } = command.netlify
  const settings = await detectBuildSettings(command)
  if (settings.length === 1) {
    return settings[0]
  }

  if (settings.length > 1) {
    /** multiple matching detectors, make the user choose */
    const scriptInquirerOptions = formatSettingsArrForInquirer(settings, type)
    /** @type {{chosenSettings: Settings}} */
    const { chosenSettings } = await inquirer.prompt({
      name: 'chosenSettings',
      message: `Multiple possible ${type} commands found`,
      // @ts-expect-error TS(2769) FIXME: No overload matches this call.
      type: 'autocomplete',
      // @ts-expect-error TS(7006) FIXME: Parameter '_' implicitly has an 'any' type.
      source(/** @type {string} */ _, input = '') {
        if (!input) return scriptInquirerOptions
        // only show filtered results
        return filterSettings(scriptInquirerOptions, input)
      },
    })

    log(`
Update your ${relConfigFilePath} to avoid this selection prompt next time:

[build]
command = "${chosenSettings.buildCommand}"
publish = "${chosenSettings.dist}"

[dev]
command = "${chosenSettings.devCommand}"
`)
    return chosenSettings
  }
}

/**
 * Detects and filters the build setting for a project and a command
 * @param {import('../commands/base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
export const detectBuildSettings = async (command) => {
  const { project, workspacePackage } = command
  const buildSettings = await project.getBuildSettings(project.workspace ? workspacePackage : '')
  return (
    buildSettings
      // @ts-expect-error TS(7006) FIXME: Parameter 'setting' implicitly has an 'any' type.
      .filter((setting) => {
        if (project.workspace && project.relativeBaseDirectory && setting.packagePath) {
          return project.relativeBaseDirectory.startsWith(setting.packagePath)
        }

        return true
      })
      // @ts-expect-error TS(7006) FIXME: Parameter 'setting' implicitly has an 'any' type.
      .filter((setting) => setting.devCommand)
  )
}
