import './App.css';
import { useSession, useSupabaseClient, useSessionContext } from '@supabase/auth-helpers-react';
import DatePicker from "react-datepicker";
import { useState } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { getDocument } from 'pdfjs-dist'; 


GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'; 


function App() {
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const session = useSession();
  const supabase = useSupabaseClient();
  const { isLoading } = useSessionContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  async function googleSignIn() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar',
        },
      });
      if (error) throw error;
    } catch (error) {
      alert("Error logging in to Google provider with Supabase");
      console.error(error);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      try {
        const fileReader = new FileReader();
  
        fileReader.onload = async function () {
          const typedArray = new Uint8Array(this.result);
          const pdfDoc = await getDocument(typedArray).promise;
  
          let fullText = "";
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(" ");
            fullText += pageText + "\n\n";
          }
  
          console.log("Extracted PDF Text:", fullText);
  
          // send the extracted text to the backend
          const response = await fetch("http://localhost:8000/detect_date", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: fullText }),
          });
          
  
          const result = await response.json();
          console.log("Backend Response:", result);

  
          if (result.events) { 
            result.events.forEach((event) => {
              alert(`Event: ${event.eventName} on ${event.date}\nDescription: ${event.eventDescription}`);
              createEvent(event.date, event.eventName, event.eventDescription);
            });
          } else {
            alert(result.message);
          }
        };
  
        fileReader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error processing PDF:", error);
        alert("An error occurred while processing the PDF.");
      }
    } else {
      alert("Please upload a valid PDF file.");
    }
  }


  async function createEvent(dateString, eventStringName, eventStringDescription) {
    try {
      // Check if session exists and has the required fields
      if (!session || !session.provider_token) {
        throw new Error("Missing or invalid session. Ensure you are logged in.");
      }

      // Validate that the date is in a correct format
      const startDate = new Date(dateString);
      const isoStartDate = startDate.toISOString(); // Convert to ISO 8601 format
  
      // Create the event object
      const event = {
        summary: eventStringName || "",
        description: eventStringDescription || "",
        start: {
          dateTime: isoStartDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use client's timezone
        },
        end: {
          dateTime: new Date(startDate.getTime() + 3600000).toISOString(), // End time 1 hour after start
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
  
      console.log("Creating Event with Payload:", JSON.stringify(event, null, 2));
  
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.provider_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
  
      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
      }
  
      const eventData = await response.json();
      console.log("Event Created Successfully:", eventData);
      alert("Event created successfully!");
    } catch (error) {
      console.error("Error Creating Event:", error);
      alert(error.message || "Failed to create event.");
    }
  }
  
  

  async function createCalendarEvent() {
    if (!eventName || !eventDescription) {
      alert("Please fill out all fields.");
      return;
    }

    setIsCreatingEvent(true);
    try {
      const event = {
        summary: eventName,
        description: eventDescription,
        start: {
          dateTime: start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.provider_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error(`Error creating event: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data);
      alert("Event created, check your Google Calendar!");
    } catch (error) {
      console.error(error);
      alert("Failed to create event. See console for details.");
    } finally {
      setIsCreatingEvent(false);
    }
  }

  return (
    <div className="App">
      <div style={{ width: "400px", margin: "30px auto" }}>
        {session ? (
          <>
            <h2>Hey there {session.user.email}</h2>
            <hr />
            <h3>Manual Event Creation</h3>
            <p>Start of your event</p>
            <DatePicker selected={start} onChange={(date) => setStart(date)} />
            <p>End of your event</p>
            <DatePicker selected={end} onChange={(date) => setEnd(date)} />
            <p>Event name</p>
            <input type="text" onChange={(e) => setEventName(e.target.value)} />
            <p>Event description</p>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              rows="4"
              style={{ width: "100%" }}
            />
            <p></p>
            <button onClick={createCalendarEvent} disabled={isCreatingEvent}>
              {isCreatingEvent ? "Creating..." : "Create Calendar Event"}
            </button>
            <p></p>
            <hr />
            <h3>Upload a PDF file</h3>
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} />
            <hr />
            <p></p>
            <button onClick={signOut}>Sign Out</button>
          </>
        ) : (
          <button onClick={googleSignIn}>Sign In With Google</button>
        )}
      </div>
    </div>
  );
}

export default App;
