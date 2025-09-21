Assignment 2 - Short Stack: Basic Two-tier Web Application using HTML/CSS/JS and Node.js
===

### Web Application Title: Workout Log

Rohan Gladson Render Website: https://a2-rohangladson.onrender.com/

### Introduction:

For my Web Application development I had decided to go about it by creating a single-page Workout Log, with it's purpose being to have it to where a user can track their fitness activities in simple, yet interactive manner. The way the user can go about using my web page is by first entering details of what their workout was in the exercise type section, in which afterwards the user would then be able to input the duration, and intensity into a form. The way that I have application set up is by having it communicate with Node.js, in which it stores and processes the data. Components that are also included this data is also built in calculator that calculates a derived field (for example, calories burned) before sending the updated dataset back to the client. When it web application interface, it's designed to be able handle updates automatically, so be able to quickly reflect all of the user's logged in workouts. The last component with the application is having the user be able edit their log as they choose. What I mean by this is that if the user inputs a log that prefer not to be there, then they have the choice of deleting that log. Along with that, if the user inputted a log, and inputted either incorrect information or mistyped, then there is also an edit feature to allow for any changes. Ultimately, the Web application is designed as a simple tool for user's to track their workouts/exercises.

### Technical Achievement(s):

### Part 1: Single-Page App Description

Rather then redescribing the process again, as we had already covered in the introduction, I think it would be best to tackle each of the files that I worked to be able to get the Web Application that I have now:

- index.html: When looking into the process of creating the index.html, I went about the process improving the on the templates functionality and also its usability. Specifically, when looking from the top down, I had defined each of the semantic sections of the Web Application with header, main content, and footer, while still trying to make sure that the page was both accessible and readable. Now, when transitioning to the main section, I designed this portion of the program with the idea the Web Application would allow users to input workout details such as exercise name, sets, reps, and weight. Along with that, another point of implementation was also having it to where each input includes built-in HTML5 validation through attributes like required, min, pattern, and placeholder. The purpose of this was more so to ensure that user entries are properly formatted before submission. One of the last couple of components that I would implement would be the hidden "Cancel Edit" button, which becomes visible when a workout entry is being updated. The last implementation that I would implement would be the inclusion of the table, which was designed to dynamically displays all workouts, including a derived "Volume" field calculated on the server. 

- main.css: The process that I had gone through modifying main.css, was to create user interface that was clear and understandable to read. While the description for this section comes off as a design based section, there exist components that were used to so as to have the proper visual look of the Web Application. One of these components comes from my usage of Flexbox, which I had used to align and center the overall layout, with a media query that adapts the design. Essentially for smaller screens, form and results stack vertically, while on larger screens they display side-by-side for improved usability. When transitioning towards other additional adjustments, one of the other areas I prioritized was removing number input spinners and adding `:focus-visible` outlines. My reasoning for this implementation came from wanting to improve accessibility for keyboard users. Overall, while this section more so fits with the design section of assignment, when looking at the technical components of the CSS, its design is to ensure the application is usable and accessible to nearly any user.

- main.js: There are many components to discuss in this section, so to be clear, I had designed main.js script to wire the SPA behavior. What I mean by this is that if you start of on 'DOMContentLoaded', its purpose it is to cache key DOM nodes (form, table body, buttons). After which, it then tracks edit state with 'editingIndex' plus a 'currentRows' cache. What follows this is my implementation of a reusable 'renderTable(rows)' function, which I designed to able to regenerate '<tbody>' from server data, which was designed to also include an "N/A" volume for activity-style rows (sets/reps/weight all zero). From this, I had then set up a small 'jsonFetch(url, data)' helper, with it's purpose being to standardizes POSTing JSON and parsing JSON responses. 

From this, when looking into the first load, the client then fetches '/read' (GET), in which it then renders the current dataset. The intention that I had behind this was for the inputs to be validated, with client-side: exercise must include letters; numbers must be non-negative; allowed patterns are either all zeros (activity-based exercises) or sets > 0, reps > 0, weight >= 0 (strength).

The next component that I considered was was implementing and edit feature, which was designed to fill inputs, while also being able to swap the submit label to "Save Changes,"shows the Cancel button, and focuses the first field; 'exitEditMode()' which I had designed to reset UI state. The last couple of components that I had implemented would be the form submit branches: '/add' which was set up for new entries, '/update' which I had set as an index for edits. I point to note about these two is that I had set up to both return the full dataset, which re-renders immediately. The last couple components in my my implemenation in main.js was the having event delegation on '<tbody>', which I had to handle row-level "Edit" and "Delete" actions. To make sure that if there were any issues that came with user input, I also made sure to have to errors appear on the surface through an 'alert' and 'console.error'.

- server.improved.js: After now going through index.html, main.css, and main.js, I would finally get to server.improved.js. For my application, the way I went about modifying this files was to make that it could handle all backend logic using Node’s built-in 'http' and 'fs' modules, along with 'mime' for content types. The way I approached this was by having the program serve two purposes, one being to host static files from the 'public/' directory and the other component being to manage workout data through JSON endpoints. 

Now when going about structuring this, I first had it where the server maintains an in-memory array of workout objects, each with: 'exercise', 'sets', 'reps', 'weight', and a derived 'volume'. From that I would then up a 'validateAndCompute()' function, which it's purpose was to check to see that the input fields were valid, while also computing the volume. Essentially by doing so, I would then be able to ensure that there was consistency across routes.

Another component that I implemented would be the usage of '/add`', as its purpose was to have new workouts be validated, processed, and then be appended to the array. When looking into my usage of '/update', it's purpose was to have it to where when an index is provided,  the corresponding entry would then be replaced with a validated row. One of the last components that I would implement would be my usage of '/delete' was to make sure that the server would then remove the specified index. Lastly, I would use '/read; so as to be able to GET endpoint to always return the full dataset in JSON, which would in turn allow the client to stay synchronized. 

### Part 2: Enabling User Modification 

With one of the components that we had tackle for our Web Application being for users to modify existing entries, the way I went implementing this feature was by having lightweight UI hooks, as well as a new server route, given that I already had established a single-page design. To make sure that the functionality would be there, I had adjust what I had done in the following files: index.html, main.js, server.improved.js.

- index.html: Given what I already established before the implementation, I had kept one form and would introduce small change in the html so as to allow for editing. This would come from adjusting the primary submit button to get an id (submit-btn) so its label can toggle between Add Workout and Save Changes. Along with this I also had to implement a Cancel Edit button (id="cancel-edit", initially hidden) so users can abandon an edit without reloading the page. From this what would come is that in the results table, each row would now be able to render both Edit and Delete buttons.

- main.js (client-side): The change that I would make here would be a little be larger in scale, when comparing it to index.html, as here I would implement an 'editingIndex' variable, whose purpose was to track whether the program was adding a new row (null) or updating an existing one (0-based index). From this, when a user clicks 'Edit', I would look through the row’s current values (from the cached currentRows), prefill the form, switch the submit button text to Save Changes, and reveal the cancel button. Then when it came to the form submit, I run the same validation as before, then branch:

  - Add mode: POST /add with { exercise, sets, reps, weight }
  - Edit mode: POST /update with { index, exercise, sets, reps, weight }. When looking at both cases, the server would return the full updated dataset, in which I would then have it where it would re-render the table and call 'exitEditMode()' to reset the form.

- server.improved.js (server-side): Similar to the main.js, this area would be little bit more extensive then the index.html, as when it came to its implementation, I would have to create a a shared validator/deriver function so to make sure that '/add' and '/update' would stay consistent. To start off '/update' was used to validate index, in which it would then recompute the derived volume (0 for "activity" rows; sets, reps, and weight for strength), which would then replace that row, and returns the updated array. 

### Technical Challenges Faced:

- Supporting Activities Without Traditional Metrics: One of the challenges that I faced was a realization throughout my Web Application Development, which was that what users inputted exercises that could not be traditionally measured. As in there physical activity could have been playing basketball, which is not something that you can measure through reps, sets, and weights. This was primary challenge, as it would lead me having to rework major sections that were already set for the time being, as my program was initially designed to handle reject zero values, which prevented logging these activities. The way Went about figuring out this problem was by introduce an alternative validation pattern, which was to have either all fields could be zero for non-strength activities, or they had to follow positive values for strength training. 

- Implementing Data Modification: Another challenge that came within this area of the assignment was implementing a modification component to Web Application, which would allow users to edit existing data. The main reason why this presented a challenge for was because of how this implementation would contradict with original set up that I had for both client and server logic. If were to start from then the process of adding and deleting rows would have been fine, given its straightforward nature. However given that basically keep the same baseline that established, and then having work around that to implement user modification presented its issues. So, the way I went about solving this matter, was by first having it where on the client side, I would have it to where it would introduce an "edit mode" state to distinguish between adding and updating workouts. Whereas on the server side, I would go about by implementing validation and replacement logic had to mirror the add operation.

---

### Design Achievement(s): 

In regards to the design section, to test my final version of the Web Application I would put it to the test by having two users use it free of use. The only task that I assigned once they opened the page, was to create a weeklong workout log, so as by the end of it, they would have 7 entries. Any more of description would have it where I would need to explain the full functionality of the page. 

Users Conducted Evaluations: Garg and Jagadeesh  

Garg Feedback: 
- The design is simple and good. 
- There are very few bugs. 
- The only one is that when you enter nothing and press add workout the fake workout is added to the list. 
- The list does not persist when you reload the page. 
- Everything is straightforward, including adding, editing, and deleting. 
- There was nothing that made it so that I couldn't understand what the task was."

Jagadeesh feedback: 
- The UI is simple and intuitive (especially the placeholder values) and the input validation worked well. 
- Liked the color scheme, and thought it fit the overall application. 
- Suggestion is to add some spacing between the edit and delete buttons for the workout. 

While the feedback from both users were all mostly positive, some issues that were noted with my Web Application which would be noted by Garg, was that the form allowed adding an empty workout when nothing was entered, and also pointed out that data does not persist on reload. When looking into Jagadeesh's feedback, he would have slight criticism towards the pages layout, as he mentioned that the edit and delete buttons were too close together and could use better spacing.

There was no major components from the user's feedback that surprised me much, but there were slights surprises here and there, as Garg would mention that despite the empty input bug, the rest of the workflow felt smooth and intuitive. However, Jagadeesh comments were partially the opposite, as his feedback on the placeholder text and color scheme was heavily positive, which was a component I had not considered, since I didn't think to heavily about those small design choices as major strengths.

Based on the feedback given to me by the two users, if were to make changes to my Web Application, I would start off with Garg's feedback, and implement stricter client-side validation to fully block empty submissions, while also considering adding persistence. From Jagadeesh's feedback, I would prioritize working on my page layout skills, and primarily focus on increasing the spacing between the edit and delete buttons to improve usability, but more importantly prevent accidental clicks.