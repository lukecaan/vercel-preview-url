import * as core from '@actions/core'
import {wait} from './wait'
import fetch from 'node-fetch'

const WAIT_LOOP_TIME = 1000 * 10 // Wait 10secs if no deploymets on each try
const MAX_RETRY_COUNT = 3 // Try three times to fetch the vercel preview

const getBranchName = (): string => {
  const isPullRequest = !!process.env.GITHUB_HEAD_REF //GITHUB_HEAD_REF is only set for pull request events https://docs.github.com/en/actions/reference/environment-variables

  let branchName
  if (isPullRequest && process.env.GITHUB_HEAD_REF) {
    branchName = process.env.GITHUB_HEAD_REF
  } else {
    if (!process.env.GITHUB_REF) {
      throw new Error('GITHUB_EVENT_PATH env var not set')
    }
    branchName = process.env.GITHUB_REF.split('/')
      .slice(2)
      .join('/')
      .replace(/\//g, '-')
  }

  return branchName
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const projectId = core.getInput('project_id')
    const teamId = core.getInput('team_id')
    core.info(`Project ID : ${projectId}`)
    core.info(`Team ID : ${teamId}`)

    // Get Branch Name
    const branchName = getBranchName()
    core.info(`Branch Name : ${branchName}`)

    // Get Vercel Token
    const apiUrl = 'https://api.vercel.com/v6/deployments'
    const vercelToken = process.env.VERCEL_TOKEN

    // Fetch vercel deployments
    const query = new URLSearchParams()
    query.append('projectId', projectId)
    if (teamId) {
      query.append('teamId', teamId)
    }
    const fullQueryUrl = `${apiUrl}?${query.toString()}`

    let counter = 0
    let deploymentUrl: string
    // Do loop
    let retryCountToUse = MAX_RETRY_COUNT // This is variable because if we find a matching deployment which just isn't deployed yet, we're happy to wait longer
    while (counter < retryCountToUse) {
      core.info(`Fetching : ${fullQueryUrl}`)
      const res = await fetch(fullQueryUrl, {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await res.json()

      // Look for a deployment with matching branch name
      const deployments = (data as any).deployments.filter(
        (deployment: any) => {
          return deployment.meta.githubCommitRef === branchName
        }
      )

      // If one doesn't exist, wait and loop
      if (deployments.length === 0) {
        core.info('No deployments found for query. Awaiting before retry')
        await wait(WAIT_LOOP_TIME)
        counter++
        continue
      } else {
        const deployment = deployments[0]
        const url = deployment.url as string
        const state = deployment.state as
          | 'BUILDING'
          | 'ERROR'
          | 'INITIALIZING'
          | 'QUEUED'
          | 'READY'
          | 'CANCELED'

        if (state === 'READY') {
          deploymentUrl = `https://${url}`
          break
        }

        if (state === 'CANCELED' || state === 'ERROR') {
          throw new Error(
            'Something went wrong with the preview deployment. State was CANCELED or ERROR'
          )
        }

        core.info(
          'Found matching deployment but state was not READY. Awaiting before retry'
        )
        retryCountToUse = 5 // Bump retry count because we know a good deployment is coming
        counter++
        continue
      }
    }

    if (counter >= retryCountToUse) {
      throw new Error('Hit maximum retry count waiting for Vercel Preview')
    }

    core.info(`Found Preview URL : ${deploymentUrl}`)
    // Return the deployment URL
    core.setOutput('preview_url', deploymentUrl)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
