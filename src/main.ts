import * as core from '@actions/core'
import {wait} from './wait'
import fetch from 'node-fetch'

const WAIT_LOOP_TIME = 1000 * 10 // Wait 10secs if no deploymets on each try
const MAX_RETRY_COUNT = 3 // Try three times to fetch the vercel preview

async function run(): Promise<void> {
  try {
    // Get inputs
    const branchName = core.getInput('branch_name')
    const projectId = core.getInput('project_id')
    const teamId = core.getInput('team_id')
    core.info(`Branch Name : ${branchName}`)
    core.info(`Project ID : ${projectId}`)
    core.info(`Team ID : ${teamId}`)

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
