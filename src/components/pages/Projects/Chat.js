import { Container, Row, Form, InputGroup, Col, Card, Button, Spinner, Alert, Accordion, Badge } from 'react-bootstrap';
import { useAccordionButton } from 'react-bootstrap/AccordionButton';
import { useParams } from "react-router-dom";
import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from '../../common/AuthProvider.js';
import ReactJson from '@microlink/react-json-view';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import toast from 'react-hot-toast';

function Chat() {

  const url = process.env.REACT_APP_RESTAI_API_URL || "";
  var { projectName } = useParams();
  const messageForm = useRef(null);
  const scoreForm = useRef(null);
  const systemForm = useRef(null);
  const kForm = useRef(null);
  const [info, setInfo] = useState({ "version": "", "embeddings": [], "llms": [], "loaders": [] });
  const [messages, setMessages] = useState([]);
  const [canSubmit, setCanSubmit] = useState(true);
  const [data, setData] = useState({ projects: [] });
  const [error, setError] = useState([]);
  const { getBasicAuth } = useContext(AuthContext);
  const user = getBasicAuth();
  const isStream = useRef(null)
  const [answert, setAnswert] = useState([]);

  const Link = ({ id, children, title }) => (
    <OverlayTrigger overlay={<Tooltip id={id}>{title}</Tooltip>}>
      <a href="#" style={{ fontSize: "small", margin: "3px" }}>{children}</a>
    </OverlayTrigger>
  );

  function CustomToggle({ children, eventKey }) {
    const decoratedOnClick = useAccordionButton(eventKey);

    return (
      <span
        onClick={decoratedOnClick} style={{ cursor: 'pointer' }}
      >
        {children}
      </span>
    );
  }

  const repeatClick = (message) => {
    messageForm.current.value = message.question;
    onSubmitHandler();
  }

  const onSubmitHandler = (event) => {
    if (isStream.current.checked) {
      handlerStream(event);
    } else {
      handler(event);
    }
  }

  const handlerStream = (event) => {
    if (event)
      event.preventDefault();

    var question = messageForm.current.value;
    var id = "";
    var k = parseInt(kForm.current.value);
    var score = parseFloat(scoreForm.current.value);

    if (messages.length === 0) {
      id = "";
    } else {
      id = messages[messages.length - 1].id
    }

    var body = {};
    var submit = false;
    if (question !== "" && id === "") {
      body = {
        "question": question,
        "k": k,
        "score": score
      }
      submit = true;
    } else if (question !== "" && id !== "") {
      body = {
        "question": question,
        "id": id,
        "k": k,
        "score": score
      }
      submit = true;
    }

    body.stream = true;
    setAnswert([]);

    if (submit && canSubmit) {
      setCanSubmit(false);
      fetchEventSource(url + "/projects/" + projectName + "/chat", {
        method: "POST",
        headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json', 'Authorization': 'Basic ' + user.basicAuth },
        body: JSON.stringify(body),
        onopen(res) {
          if (res.ok && res.status === 200) {
            console.log("Connection made ", res);
          } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            console.log("Client-side error ", res);
          }
        },
        onmessage(event) {
          if (event.event === "close") {
            setAnswert((answert) => [...answert, event.data]);
            setAnswert((answert) => [...answert, "RESTAICLOSED"]);
          } else if (event.data === "") {
            setAnswert((answert) => [...answert, "\n"]);
          } else {
            setAnswert((answert) => [...answert, event.data]);
          }

        },
        onclose() {
          console.log("Connection closed by the server");
        },
        onerror(err) {
          console.log("There was an error from server", err);
        },
      });
    }
  }

  const handler = (event) => {
    if (event)
      event.preventDefault();

    var question = messageForm.current.value;
    var id = "";
    var k = parseInt(kForm.current.value);
    var score = parseFloat(scoreForm.current.value);

    if (messages.length === 0) {
      id = "";
    } else {
      id = messages[messages.length - 1].id
    }

    var body = {};
    var submit = false;
    if (question !== "" && id === "") {
      body = {
        "question": question,
        "k": k,
        "score": score
      }
      submit = true;
    } else if (question !== "" && id !== "") {
      body = {
        "question": question,
        "id": id,
        "k": k,
        "score": score
      }
      submit = true;
    }

    if (submit && canSubmit) {
      setCanSubmit(false);
      setMessages([...messages, { id: id, question: question, answer: null, sources: [] }]);
      fetch(url + "/projects/" + projectName + "/chat", {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json', 'Authorization': 'Basic ' + user.basicAuth }),
        body: JSON.stringify(body),
      })
        .then(function (response) {
          if (!response.ok) {
            response.json().then(function (data) {
              setError(data.detail);
            });
            throw Error(response.statusText);
          } else {
            return response.json();
          }
        })
        .then((response) => {
          setMessages([...messages, { id: response.id, question: response.question, answer: response.answer, sources: response.sources }]);
          messageForm.current.value = "";
          setCanSubmit(true);
          if (response.sources.length === 0) {
            toast.error('No sources found for this question. Decrease the score cutoff parameter.', { duration: 6000 , position: 'top-right' });
          }
        }).catch(err => {
          setError(err.toString());
          setMessages([...messages, { id: id, question: question, answer: "Error, something went wrong with my transistors.", sources: [] }]);
          setCanSubmit(true);
        });
    }
  }

  const fetchProject = (projectName) => {
    return fetch(url + "/projects/" + projectName, { headers: new Headers({ 'Authorization': 'Basic ' + user.basicAuth }) })
      .then(function (response) {
        if (!response.ok) {
          response.json().then(function (data) {
            setError(data.detail);
          });
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((d) => setData(d)
      ).catch(err => {
        setError([...error, { "functionName": "fetchProject", "error": err.toString() }]);
      });
  }

  const fetchInfo = () => {
    return fetch(url + "/info", { headers: new Headers({ 'Authorization': 'Basic ' + user.basicAuth }) })
      .then(function (response) {
        if (!response.ok) {
          response.json().then(function (data) {
            setError(data.detail);
          });
          throw Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .then((d) => setInfo(d)
      ).catch(err => {
        setError([...error, { "functionName": "fetchInfo", "error": err.toString() }]);
      });
  }

  const checkPrivacy = () => {
    var embbeddingPrivacy = true;
    info.embeddings.forEach(function (element) {
      if (element.name === data.embeddings && element.privacy === "public")
        embbeddingPrivacy = false;
    })
    if (embbeddingPrivacy && data.llm_privacy === "private") {
      return true;
    } else {
      return false;
    }
  }

  useEffect(() => {
    document.title = 'Chat - ' + projectName;
    fetchProject(projectName);
    fetchInfo();
  }, [projectName]);

  useEffect(() => {
    if (answert[answert.length - 1] === "RESTAICLOSED") {
      answert.pop()
      var info = JSON.parse(answert.pop());
      setMessages([...messages, { id: info.id, question: messageForm.current.value, answer: answert.join('').trim().replace(/\n\n\n/g, '\n\n'), sources: info.sources }]);
      setAnswert([]);
      messageForm.current.value = "";
      setCanSubmit(true);
      if (info.sources.length === 0) {
        toast.error('No sources found for this question. Decrease the score cutoff parameter.', { duration: 6000 , position: 'top-right' });
      }
    }
  }, [answert]);

  return (
    <>
      {error.length > 0 &&
        <Alert variant="danger" style={{ textAlign: "center" }}>
          {JSON.stringify(error)}
        </Alert>
      }
      <Container style={{ marginTop: "20px" }}>
        <h1>Chat - {projectName}</h1>
        <h5>
          {checkPrivacy() ?
            <Badge bg="success">Local AI <Link title="You are NOT SHARING any data with external entities.">ℹ️</Link></Badge>
            :
            <Badge bg="danger">Public AI <Link title="You ARE SHARING data with external entities.">ℹ️</Link></Badge>
          }
        </h5>
        <Row style={{ marginBottom: "15px", marginTop: "-9px" }}>
          <Col sm={12}>
            (Remember that the LLM needs to support Chat mode for this to work, unstable otherwise)
          </Col>
        </Row>
        <Form onSubmit={onSubmitHandler}>
          <Row>
            <Col sm={12}>
              <InputGroup>
                <InputGroup.Text>System</InputGroup.Text>
                <Form.Control disabled ref={systemForm} rows="5" as="textarea" aria-label="With textarea" defaultValue={data.system ? data.system : ""} />
              </InputGroup>
            </Col>
            {(messages.length > 0 || answert.length > 0) &&
              <Col sm={12}>
                <Card>
                  <Card.Header>Results</Card.Header>
                  <Card.Body>
                    {
                      messages.map((message, index) => {
                        return (
                          <div>
                            <div className='lineBreaks' key={index} style={index === 0 ? { marginTop: "0px" } : { marginTop: "10px" }}>
                              🧑<span className='highlight'>MESSAGE:</span> {message.question} <br />
                              🤖<span className='highlight'>RESPONSE:</span> {(message.answer == null ? <Spinner animation="grow" size="sm" /> : message.answer)}
                            </div>
                            <div style={{ marginBottom: "0px" }}>
                              <Accordion>
                                <div style={{ textAlign: "right", marginBottom: "0px" }}>
                                  <CustomToggle title="Details" eventKey="0" >🔎</CustomToggle>
                                  <span title="Repeat" style={{ marginLeft: "10px", cursor: "pointer" }} onClick={() => repeatClick(message)}>🔁</span>
                                </div>
                                <Accordion.Collapse eventKey="0">
                                  <Card.Body><ReactJson src={message} enableClipboard={false} /></Card.Body>
                                </Accordion.Collapse>
                              </Accordion>
                            </div>
                            <hr />
                          </div>
                        )
                      })
                    }
                    {answert.length > 0 &&
                      <div className='lineBreaks' style={{ marginTop: "10px" }}>
                        🧑<span className='highlight'>MESSAGE:</span> {messageForm.current.value} <br />
                        🤖<span className='highlight'>RESPONSE:</span> {answert}
                        <hr />
                      </div>
                    }
                  </Card.Body>
                </Card>
              </Col>
            }
          </Row>
          <Row style={{ marginTop: "20px" }}>
            <Col sm={12}>
              <InputGroup>
                <InputGroup.Text>Message</InputGroup.Text>
                <Form.Control ref={messageForm} rows="5" as="textarea" aria-label="With textarea" />
              </InputGroup>
            </Col>
          </Row>
          <Row style={{ marginTop: "20px" }}>
            <Col sm={6}>
              <InputGroup>
                <InputGroup.Text>Score Cutoff<Link title="Value between 0 and 1. Larger equals more similarity required from embeddings during retrieval process. Smaller less similarity required.">ℹ️</Link></InputGroup.Text>
                <Form.Control ref={scoreForm} defaultValue={data.score} />
              </InputGroup>
            </Col>
            <Col sm={6}>
              <InputGroup>
                <InputGroup.Text>k<Link title="Bigger value slower results but more data from embeddings will be used.">ℹ️</Link></InputGroup.Text>
                <Form.Control ref={kForm} defaultValue={data.k} />
              </InputGroup>
            </Col>
          </Row>
          <Row style={{ marginTop: "20px" }}>
            <Col sm={9}>
            </Col>
            <Col sm={1}>
              <Form.Group as={Col} controlId="formGridAdmin">
                <Form.Check ref={isStream} type="checkbox" label="Stream" />
              </Form.Group>
            </Col>
            <Col sm={2}>
              <div className="d-grid gap-2">
                <Button variant="dark" type="submit" size="lg">
                  {
                    canSubmit ? <span>Chat</span> : <Spinner animation="border" />
                  }
                </Button>
              </div>
            </Col>
          </Row>
        </Form>
      </Container>
    </>
  );
}

export default Chat;