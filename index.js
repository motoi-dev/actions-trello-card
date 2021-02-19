const core = require('@actions/core')
const github = require('@actions/github')
const fetch = require('node-fetch')

const apiKey = process.env['TRELLO_API_KEY'];
const apiToken = process.env['TRELLO_API_TOKEN'];
const boardId = process.env['TRELLO_BOARD_ID'];
const action = core.getInput('action-on-trello');

try {
  switch (action) {
    case 'create_card_when_milestone_opened':
      createCardWhenMilestoneOpened(apiKey, apiToken);
      break;
    case 'update_card_when_milestone_edited':
      updateCardWhenMilestoneEdited(apiKey, apiToken, false);
      break;
    case 'complete_card_when_milestone_closed':
      updateCardWhenMilestoneEdited(apiKey, apiToken, true);
      break;
    // case 'create_card_when_milestones_deleted':
    //   createCardWhenMilestoneDeleted(apiKey, apiToken, boardId);
    //   break;
    case 'update_card_when_issue_milestoned':
      updateCardWhenIssueMilestoned(apiKey, apiToken);
      break;
    case 'update_card_when_issue_closed_or_reopened':
      updateCardWhenIssueClosedOrReopened(apiKey, apiToken);
      break;
  }
} catch (error) {
  core.setFailed(error.message);
}

function createCardWhenMilestoneOpened(apiKey, apiToken) {
  const listId = process.env['TRELLO_LIST_ID']
  const milestone = github.context.payload.milestone
  const htmlUrl = milestone.html_url
  const id = milestone.id
  const title = milestone.title
  const description = milestone.description
  const state = milestone.state
  const dueOn = milestone.due_on
  const repositoryName = github.context.payload.repository.name

  const paraObj = {
    html_url: htmlUrl,
    id: id,
    title: title,
    description: description,
    state: state,
    due_on: dueOn,
    id_labels: [ repositoryName ]
  }

  createACard(apiKey, apiToken, listId, paraObj)

}

function updateCardWhenMilestoneEdited(apiKey, apiToken, dueComplete) {
  const listId = process.env['TRELLO_LIST_ID']
  const milestone = github.context.payload.milestone
  const htmlUrl = milestone.html_url
  const id = milestone.id
  const title = milestone.title
  const description = milestone.description
  const state = milestone.state
  const dueOn = milestone.due_on

  const paraObj = {
    html_url: htmlUrl,
    id: id,
    title: title,
    description: description,
    state: state,
    due_on: dueOn,
    due_complete: dueComplete
  }

  getCardsInAList(apiKey, apiToken, listId)
    .then((result) => {
      const cardArray = result
      let targetCardId
      for (let card of cardArray) {
        if (card.name === paraObj.title) {
          targetCardId = card.id
          break
        }
      }

      updateACard(apiKey, apiToken, targetCardId, paraObj)
    })

}


function updateCardWhenIssueMilestoned(apiKey, apiToken) {
  const listId = process.env['TRELLO_LIST_ID']
  const issue = github.context.payload.issue
  const htmlUrl = issue.html_url
  const id = issue.id
  const title = issue.title
  const description = issue.description
  const state = issue.state
  const createdAt = issue.created_at
  const assignees = issue.assignees
  const milestone = issue.milestone

  const paraObj = {
    html_url: htmlUrl,
    id: id,
    title: title,
    description: description,
    state: state,
    created_at: createdAt,
    assignees: assignees,
    milestone: milestone
  }

  getCardsInAList(apiKey, apiToken, listId)
    .then((result) => {
      const cardArray = result
      let targetChecklistId
      for (let card of cardArray) {
        if (card.name === paraObj.milestone.title) {
          targetChecklistId = card.idChecklists[0]
          break
        }
      }
      createCheckitemOnChecklist(apiKey, apiToken, targetChecklistId, paraObj.title)
    })

}

function updateCardWhenIssueClosedOrReopened(apiKey, apiToken) {
  const listId = process.env['TRELLO_LIST_ID']
  const issue = github.context.payload.issue
  const htmlUrl = issue.html_url
  const id = issue.id
  const title = issue.title
  const description = issue.description
  const state = issue.state
  const createdAt = issue.created_at
  const assignees = issue.assignees
  const milestone = issue.milestone

  const paraObj = {
    html_url: htmlUrl,
    id: id,
    title: title,
    description: description,
    state: state,
    created_at: createdAt,
    assignees: assignees,
    milestone: milestone,
    action: github.context.payload.action
  }

  getCardsInAList(apiKey, apiToken, listId)
    .then((result) => {
      const cardArray = result
      let targetCardId
      let targetChecklistId
      for (let card of cardArray) {
        if (card.name === paraObj.milestone.title) {
          targetCardId = card.id
          targetChecklistId = card.idChecklists[0]
          break
        }
      }
      updateACheckitemOnACard(apiKey, apiToken, targetCardId, targetChecklistId, paraObj)
    })

}

function createACard(apiKey, apiToken, listId, paraObj) {
  const obj = {
    key: apiKey,
    token: apiToken,
    idList: listId,
    name: paraObj.title,
    desc: paraObj.description,
    due: paraObj.due_on,
    pos: 'top'
  }
  getLabelsOnABoard(apiKey, apiToken, boardId)
    .then((response) => {
      let targetLabelId
      for (let label of response) {
        if (label.name === paraObj.id_labels[0]) {
          targetLabelId = label.id
          break
        }
      }
      obj.idLabels = targetLabelId
      const query = new URLSearchParams(obj)
      fetch(
        `https://api.trello.com/1/cards?${query}`,
        {
          method: 'POST',
        }
      )
      .then(async (response) => {
        let result = await response.json()
        createChecklistOnACard(apiKey, apiToken, result.id)
      })
    })
}

async function updateACard(apiKey, apiToken, cardId, paraObj) {
  const obj = {
    key: apiKey,
    token: apiToken,
    name: paraObj.title,
    desc: paraObj.description,
    due: paraObj.due_on,
    dueComplete: paraObj.due_complete
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/cards/${cardId}?${query}`,
    {
      method: 'PUT'
    }
  )
}

async function getCardsInAList(apiKey, apiToken, listId) {
  let result
  const obj = {
    key: apiKey,
    token: apiToken,
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/lists/${listId}/cards?${query}`,
    {
      method: 'GET'
    }
  )
  .then(async (response) => {
    result = await response.json()
  })
  .catch((error) => {
    result = error
  })

  return result
}

async function createChecklistOnACard(apiKey, apiToken, cardId) {
  const obj = {
    id: cardId,
    key: apiKey,
    token: apiToken,
    name: '💻 GitHub Issues'
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/cards/${cardId}/checklists?${query}`,
    {
      method: 'POST'
    }
  )
  .then(async (response) => {
    console.log(response)
  })
  .catch((error) => {
    console.log(error)
  })

}

// async function updateAChecklist(apiKey, apiToken, checklistId) {
//   const obj = {
//     id: checklistId,
//     key: apiKey,
//     token: apiToken,
//   }
//   const query = new URLSearchParams(obj)
//   await fetch(
//     `https://api.trello.com/1/cards/${cardId}/checklists?${query}`,
//     {
//       method: 'PUT'
//     }
//   )
//   .then(async (response) => {
//     console.log(response)
//   })
//   .catch((error) => {
//     console.log(error)
//   })

// }

async function createCheckitemOnChecklist(apiKey, apiToken, checklistId, title) {
  const obj = {
    key: apiKey,
    token: apiToken,
    name: title
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/checklists/${checklistId}/checkItems?${query}`,
    {
      method: 'POST'
    }
  )
  .then(async (response) => {
    result = await response.json()
    console.log(result)
  })
  .catch((error) => {
    console.log(error)
  })

}

async function updateACheckitemOnACard(apiKey, apiToken, targetCardId, checklistId, paraObj) {
  const obj = {
    key: apiKey,
    token: apiToken,
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/checklists/${checklistId}?${query}`,
    {
      method: 'GET'
    }
  )
  .then(async (response) => {
    result = await response.json()
    let targetCheckItemId
    for (let checkItem of result.checkItems) {
      if (checkItem.name === paraObj.title) {
        targetCheckItemId = checkItem.id
        break
      }
    }
    console.log(paraObj)
    let state
    switch(paraObj.action) {
      case 'closed':
        state = 'complete'
      case 'reopened':
        state = 'incomplete'
    }
    const obj = {
      key: apiKey,
      token: apiToken,
      state: state
    }
    console.log(obj)
    const query = new URLSearchParams(obj)
    await fetch(
      `https://api.trello.com/1/cards/${targetCardId}/checkItem/${targetCheckItemId}?${query}`,
      {
        method: 'PUT'
      }
    )
    .then(async (response) => {
      result = await response.json()
    })
    .catch((error) => {
      console.log(error)
    })
  })
  .catch((error) => {
    console.log(error)
  })
}

async function getLabelsOnABoard(apiKey, apiToken, boardId) {
  let result
  const obj = {
    key: apiKey,
    token: apiToken
  }
  const query = new URLSearchParams(obj)
  await fetch(
    `https://api.trello.com/1/boards/${boardId}/labels?${query}`,
    {
      method: 'GET'
    }
  )
  .then(async (response) => {
    result = await response.json()
  })
  .catch((error) => {
    result = error
  })

  return result
}
