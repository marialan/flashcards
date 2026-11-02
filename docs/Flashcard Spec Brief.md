

**Open Source Workshop**  
**“Flashcard” Interaction**  
**Specification Brief**

Curious Learning

Product Specification for  
“Creating Literacy Games with React Native” workshop

Prepared by: Ben Burrage \<bburrage@curiouslearning.org\>

| DOCUMENT REVISION HISTORY *assign date stamp/sign off to accepted versions* |  |  |
| :---- | :---- | :---- |
| **Date** | **Version No** | **Author** |
| Apr. 11th, 2017 | V.1 | bburrage@curiouslearning.org |
|  |  |  |

# Glossary

### MVP

Minimum Viable Product. A small, testable piece of completed software that provides value to a user.

# Project Difficulty and Information

This project’s difficulty rating is: Beginner

This project does not have an existing code base for reference.

This project can be completed with non-English language content.

# Purpose/objective

The pedagogical objective of the “Flashcard” interaction paradigm is to make a connection between an image and a word. An example would be presenting a stimulus (an image of an alligator) on the front of the card and on the back is more information about the image (the word “Alligator”). 

# MVP Implementation

### UI Requirements

* A rectangular image display area with a border to show an image. When flipping the card, the display area will display the written word for the image. 

### Functional Requirements

* The child will touch the flashcard to:

\- Replace the image in the display area to the written word describing the image.  
\- Play an audio file saying the written word.

### Constraints

* Images must be resized to fit the flashcard area.

### Input Requirements

* Your application should be able to read in a JSON file that contains card definitions and the order in which they should be displayed.

### Provided Inputs

You will be given a JSON file which will look something like:

// Card definitions  
\[  
{  
		"card\_id" : string, // a unique card ID  
		“target\_word” : string // the target word to learn from the card  
	},

	…  
\]

// What to display in the UI definition  
\[  
	{  
		“card\_order” : string\[ \], // an array of card\_ids to display and in what order  
	}

\]

### Media Asset Considerations

In this app, each card will also have an association with:

* Front of card image (or animation)  
* Back of card word  
* Back of card audio

# Better Implementation

### Additional UI Requirements

* The UI should now contain next and previous arrows to navigate between all the cards at will. 

### Additional Functional Requirements

* The child should be able to flip a flashcard back and forth as many times as they want.

# 

# Great Implementation

### Additional UI Requirements

* The UI should drop the previous and next navigation arrows and instead show in a carousel fashion:

\- One full flashcard.  
\- A portion of the previous flashcard next to the full flashcard.  
\- A portion of the next flashcard next to the full flashcard.

### Additional Functional Requirements

* Allow the child to tap the previous or next flashcard in the UI to go to that flashcard and rotate in a new next and previous flashcards.  
* Allow the child to swipe left or right to spin the carousel of flashcards.  
* Create an animation of the flashcard flipping front to back (and back to front) when the child taps on the current flashcard depending on what side of the flashcard is visible in the UI.