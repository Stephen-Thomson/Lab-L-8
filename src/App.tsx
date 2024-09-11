import React, { useEffect, useState } from 'react'
import { Container, TextField, Button, Card, CardContent, Typography, Grid, MenuItem } from '@mui/material'
import pushdrop from 'pushdrop'
import { createAction, getTransactionOutputs } from '@babbage/sdk-ts'
import { v4 as uuidv4 } from 'uuid' // v4 refers to version 4 of the UUID, which generates random UUIDs.
import { EnvelopeApi } from '@babbage/sdk-ts'

// Define the structure of a card
interface CardData {
  name: string
  description: string
  rarity: string
  ability: string
  history: string
  sats: number
  txid: string
  outputIndex: number
  outputScript: string
  keyID: string
  envelope: EnvelopeApi | undefined
}

// 1. Generate a unique key ID for each card
const generateUniqueKeyID = () => {
  return uuidv4()
}

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [cardName, setCardName] = useState('')
  const [cardDescription, setCardDescription] = useState('')
  const [cardRarity, setCardRarity] = useState('')
  const [cardAbility, setCardAbility] = useState('')
  const [history, setHistory] = useState<string>('')
  const [sats, setSats] = useState<number>(1)
  const [cards, setCards] = useState<CardData[]>([])

  // Load existing cards when the component mounts
  useEffect(() => {
    loadCards()
  }, [])

  // 2. Create a new card token
  const handleCreateCard = async () => {
    setIsLoading(true)
    try {
      // Ensure all fields are filled out
      if (!cardName || !cardDescription || !cardRarity || !cardAbility || sats <= 0) {
        alert("Please fill out all fields and set a valid value for sats")
        return
      }

      // Generate unique key ID for the card
      const keyID = generateUniqueKeyID()

      // Create the locking script using pushdrop.create
      const cardAttributes = {
        name: cardName,
        description: cardDescription,
        rarity: cardRarity,
        ability: cardAbility
      }

      const outputScript = await pushdrop.create({
        fields: [JSON.stringify(cardAttributes)], // Store fields as JSON
        protocolID: 'card collectibles',
        keyID,
      })

      // Create the blockchain transaction using createAction
      await createAction({
        outputs: [
          {
            satoshis: sats,
            script: outputScript,
            basket: 'game_collectibles',
            customInstructions: JSON.stringify({
              keyID,
              history,
            }),
          },
        ],
        description: 'Creating a new collectible card',
      })

      // Reload the cards to update the UI
      await loadCards()

      // Clear the form after the card is created
      setCardName('')
      setCardDescription('')
      setCardRarity('')
      setCardAbility('')
      setSats(1)
      setHistory('')
      alert('Card successfully created!')
    } catch (error) {
      console.error('Error creating card:', error)
      alert('Failed to create card')
    } finally {
      setIsLoading(false)
    }
  }

  // Load the cards from the "game_collectibles" basket
  const loadCards = async () => {
    try {
      setIsLoading(true)

      const itemsFromBasket = await getTransactionOutputs({
        basket: 'game_collectibles',
        spendable: true,
        includeEnvelope: true,
      })

      const decodedCards = await Promise.all(itemsFromBasket.map(async (item: any) => {
        const decodedFields = await pushdrop.decode({
          script: item.outputScript,
          fieldFormat: 'utf8'
        })

        const cardData = JSON.parse(decodedFields.fields[0])

        // Parse the custom instructions to get keyID and history
        const customInstructions = item.customInstructions ? JSON.parse(item.customInstructions) : {}

        return {
          name: cardData.name,
          description: cardData.description,
          rarity: cardData.rarity,
          ability: cardData.ability,
          sats: item.amount,
          keyID: customInstructions.keyID || '',
          history: customInstructions.history || '',
          txid: item.txid,
          outputIndex: item.vout,
          outputScript: item.outputScript,
          envelope: item.envelope
        } as CardData
      }))

      setCards(decodedCards)
    } catch (error) {
      console.error('Error loading cards:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Redeem a card by unlocking it on the blockchain
  const handleRedeemCard = async (card: CardData) => {
    setIsLoading(true);
    try {
        const cardKeyID = card.keyID;

        // Ensure that txid, outputIndex, and lockingScript are valid
        if (!card.txid || card.outputIndex === undefined || !card.outputScript) {
            throw new Error('Invalid transaction or output details for the card.');
        }

        // Use pushdrop.redeem to create an unlocking script
        const unlockScript = await pushdrop.redeem({
            protocolID: 'card collectibles',
            keyID: cardKeyID,
            prevTxId: card.txid,
            outputIndex: card.outputIndex,
            lockingScript: card.outputScript,
            outputAmount: card.sats,
        });

        // Create a new action (transaction) that redeems the card
        const action = await createAction({
          inputs: {
              [card.txid]: {
                  ...card.envelope,  // Spread the envelope (token) properties here
                  outputsToRedeem: [
                      {
                          index: card.outputIndex,
                          unlockingScript: unlockScript, // Unlocking script provided by PushDrop
                      }
                  ],
              },
          },
          description: `Redeeming collectible card: ${card.name}`,
        });

        // Reload the cards after redeeming
        await loadCards();

        alert(`Card "${card.name}" successfully redeemed!`);
    } catch (error) {
        console.error('Error redeeming card:', error);
        alert('Failed to redeem card.');
    } finally {
        setIsLoading(false);
    }
};

  return (
    <Container maxWidth="md" sx={{ paddingTop: '3em' }}>
      <Typography variant="h3" gutterBottom>
        Collectible Card Creator
      </Typography>
      <Grid container spacing={3}>
        {/* Create a form for new cards, and display existing cards */}
        <Grid item xs={12}>
          <form noValidate autoComplete="off">
            <TextField
              fullWidth
              label="Card Name"
              value={cardName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardName(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={cardDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDescription(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Rarity"
              value={cardRarity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardRarity(e.target.value)}
              margin="normal"
              select
            >
              <MenuItem value="common">Common</MenuItem>
              <MenuItem value="rare">Rare</MenuItem>
              <MenuItem value="epic">Epic</MenuItem>
              <MenuItem value="legendary">Legendary</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Ability"
              value={cardAbility}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardAbility(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Value (in satoshis)"
              type="number"
              value={sats}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSats(Number(e.target.value))}
              margin="normal"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateCard}
              disabled={isLoading}
              sx={{ marginTop: '1em' }}
            >
              Create Card
            </Button>
          </form>
        </Grid>

        {/* Display the list of cards */}
        <Grid container spacing={3}>
          {cards.map((card, index) => (
            <Grid item xs={12} key={index}>
              <Card>
                <CardContent>
                  <Typography variant="h5">{card.name}</Typography>
                  <Typography variant="body2" color="textSecondary">{card.description}</Typography>
                  <Typography variant="body1">Rarity: {card.rarity}</Typography>
                  <Typography variant="body1">Ability: {card.ability}</Typography>
                  <Typography variant="body1">Value: {card.sats} satoshis</Typography>

                  {/* Redeem Button */}
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleRedeemCard(card)}
                    disabled={isLoading}
                    sx={{ marginTop: '1em' }}
                  >
                    Redeem Card
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Container>
  )
}

export default App
